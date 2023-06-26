import fs from 'node:fs'
import fsPromise from 'node:fs/promises'
import * as _ from 'lodash'
import path from 'path'
import type { Socket } from 'net'

import type { TContribBlock } from '@/services/diffs'

import logger from '@/logger'
import config from '@/config/config'

import git from '@/services/git'
import CAWStore from '@/services/store'
import CAWDiffs from '@/services/diffs'

type TRepoAddReq = {
  folder: string
  cid: string // the VSCode guid (supporting multiple instances of VSCode)
}

type TRepoActivateReq = {
  fpath: string // activated file's path
  doc: string // activated file's content
  cid: string
}

// TODO: group CAWStore projects by cid value

async function activatePath(data: any): Promise<any> {
  const { fpath, cid, doc }: TRepoActivateReq = data
  if (!fpath) return
  logger.log('REPO: activate path (fpath, cid)', fpath, cid)
  if (fpath.toLowerCase().includes(CAWStore.tmpDir.toLowerCase())) return Promise.resolve() // active file is the temporary diff file

  /* select the project corresponding to the activated path; if there is no project matching, we add as new project */
  const project = await selectProject(fpath, cid, this)
  project.activePath = fpath
  logger.log('REPO: activatePath project selected', fpath, project)

  if (!project.cSHA) {
    await CAWDiffs.sendDiffs(project, cid)
  }

  /* next up: download changes from peers */
  return CAWDiffs
    .refreshChanges(project, project.activePath, doc, cid)
    .then(() => {
      this.emit('res:repo:active-path', project)
    })
}

function getProjectFromPath(fpath: string) {
  const plist = CAWStore.projects.filter(p => fpath.includes(p.root))
  let project: any
  let len = 0
  // select longest path to guarantee working properly even on git submodules
  plist.map(p => {
    if (p.root.length > len) project = p
    len = p.root.length
  })
  return project
}

/**
 * Select the project containing the requested file path, and UPDATE the server with its latest DIFFS.
 *
 * @param string the file path for the current file open in the editor
 * @param string the client ID
 * @param object the web socket, used to reply when everything's done. This is currently the pipe IPC socket, but it can be websockets too.
 */
function selectProject(fpath: string, cid: string, socket: Socket): Promise<any> {
  let project = getProjectFromPath(fpath)
  const wsFolder = path.dirname(fpath)
  if (!project?.cSHA) {
    return git.command(wsFolder, 'git rev-parse --show-toplevel')
      .then(folder => add({ folder, cid }, socket))
      .then(newProject => {
        project = newProject
        project.activePath = fpath.substring(0, project.root.length + 1)
        logger.info('REPO: the relative active path is', project.activePath)
        CAWStore.projects.push(project) // TODO: used for SCM, but we need to also use socket id, cid
        CAWStore.activeProjects[cid] = project
        setupClientSync(cid, project, socket)
        return git.command(wsFolder, 'git branch --no-color')
      })
      .then(stdout => {
        const lines = stdout.split('\n')
        project.branch = lines.filter(l => /^\*/.test(l))[0].substr(2)
        project.branches = lines.map(line => line.replace('* ', '').replace(/\s/g, '')).filter(a => a)
        return project
      })
  } else {
    setupClientSync(cid, project, socket)
  }
  CAWStore.activeProjects[cid] = project
  // TODO: send diffs on a timer? (for example when more than 5 minutes have passed)
  return Promise.resolve(project)
}

function setupClientSync(cid, project, socket) {
  if (!CAWStore.timers[cid]) CAWStore.timers[cid] = {}
  const timer = CAWStore.timers[cid][project.root]
  if (!timer) {
    // some other client may have already setup a sync process for the same project
    const exists = Object.keys(CAWStore.timers).map(cid => CAWStore.timers[cid][project.root]).filter(r => r !== undefined)[0]
    if (!exists) {
      CAWStore.timers[cid][project.root] = setupPeriodicSync(project, cid, socket)
    } else {
      return setInterval(() => {
        CAWStore.wsStation[cid].emit('res:sync:setup', { action: 'refresh', root: project.root })
      }, config.SYNC_INTERVAL)
    }
  }
}

function setupPeriodicSync(project: any, cid: string, socket: Socket): ReturnType<typeof setInterval> {
  logger.log(`IPC: setting up sync for ${cid}`)
  return setInterval(() => {
    CAWDiffs.sendDiffs(project, cid)
      .then(() => {
        CAWStore.wsStation[cid].emit('res:sync:setup', { action: 'refresh', root: project.root })
      })
  }, config.SYNC_INTERVAL)
}

function add(requested: TRepoAddReq, socket?: Socket): Promise<any> {
  const folder = requested.folder.trim()
  logger.info('REPO: addProject', folder)
  try {
    fs.accessSync(path.join(folder, '.git'))
  } catch (err) {
    logger.log('SCM Not a git folder', folder, err)
    return Promise.resolve() // TODO: maybe allow other source control tools, besides git?
  }
  // TODO: pull changes to local workspace
  // Setup project origins
  const peers = {}
  const changes = {}
  const ws = socket || this
  return git.getRemotes(folder)
    .then(origin => {
      console.log('EXISTING PROJECTS', CAWStore.projects.map(p => p.origin))
      const existing = CAWStore.projects.filter(p => p.origin === origin)[0]
      if (existing) {
        ws.emit('res:repo:add', { project: existing })
        return existing
      }
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = folder
      const name = path.basename(root)
      // TODO: cleanup CAWStore.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, peers }
      logger.log('REPO: adding new project', project)
      ws.emit('res:repo:add', { project })
      return project
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
}

function remove({ folder }) {
  const project = CAWStore.projects.filter(m => m.name === path.basename(folder))[0]
  logger.info('SCM removeProject folder', folder, project)
  if (project) {
    CAWStore.projects = CAWStore.projects.filter(m => m.origin !== project.origin)
  }
  this.emit('res:repo:removed', { folder })
}

function addSubmodules({ folder, cid }: TRepoAddReq): Promise<void> {
  // TODO: add submodules of submodules ? (recursive)
  return git.command(folder, 'git submodule status')
    .then(out => {
      if (!out) return
      const subs = []
      out.split('\n').map(line => {
        const res = / ([^\s]+) ([^\s]+) /.exec(line)
        if (res) subs.push(res[2])
      })
      logger.log('SCM git submodules: ', out, subs)
      const promises = subs.map(sub => add({ folder: path.join(folder, sub), cid }))
      return Promise.all(promises)
        .then(projects => {
          this.emit('res:repo:add-submodules', projects)
        })
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
}

function getTmpDir(cid) {
  if (!CAWStore.uTmpDir[cid]) {
    const uPath = path.join(CAWStore.tmpDir, cid)
    try {
      fs.mkdirSync(uPath)
      fs.mkdirSync(path.join(uPath, config.ARCHIVE_DIR))
      fs.mkdirSync(path.join(uPath, config.EXTRACT_BRANCH_DIR))
      fs.mkdirSync(path.join(uPath, config.EXTRACT_DOWNLOAD_DIR))
      fs.mkdirSync(path.join(uPath, config.EXTRACT_LOCAL_DIR))
      fs.mkdirSync(path.join(uPath, config.EXTRACT_PEER_DIR))
      fs.mkdirSync(path.join(uPath, config.EXTRACT_REPO_DIR))
    } catch (err) {
      console.error(err)
    }
    CAWStore.uTmpDir[cid] = uPath
  }

  this.emit('res:repo:get-tmp-dir', { tmpDir: CAWStore.uTmpDir[cid] })
}

type TBranchDiffInfo = {
  branch: string
  cid: string
}

/**
 * @param info object { fpath, branch, origin, cid }
 */
function diffWithBranch(info: TBranchDiffInfo) {
  return CAWDiffs
    .diffWithBranch(info)
    .then(diffs => this.emit('res:repo:diff-branch', diffs))
}

type TContribDiffInfo = {
  fpath: string
  peer: any
  origin: string
  cid: string
  doc: string
}

/**
 * @param info object { fpath, peer, origin, cid }
 */
function diffWithPeer(info: TContribDiffInfo) {
  return CAWDiffs
    .diffWithPeer(info)
    .then(diffs => this.emit('res:repo:diff-peer', diffs))
}

function readFile({ fpath }) {
  fsPromise.readFile(fpath).then(doc => doc.toString('utf8'))
}

function vscodeDiff({ wsFolder, fpath, uid, cid }) {
  const absPath = path.join(wsFolder, fpath)
  try {
    fs.accessSync(absPath, fs.constants.R_OK)
    this.emit('res:repo:vscode-diff', { exists: true, res1: path.join(wsFolder, fpath) })
  } catch (err) {
    const tmpDir = CAWStore.uTmpDir[cid]
    const activeProject = CAWStore.activeProjects[cid]
    const tmpFile = _.uniqueId(path.basename(fpath))
    const tmp = path.join(tmpDir, tmpFile)
    fs.writeFileSync(tmp, '')
    const wsName = path.basename(activeProject.root)
    const res1 = tmp
    const res2 = path.join(tmpDir, uid, wsName, config.EXTRACT_PEER_DIR, fpath)
    this.emit('res:repo:vscode-diff', { res1, res2 })
  }
}

type TSendDiff = {
  fpath: string
  doc: any
  cid: string
}

/**
 * when a file is saved in the editor, we send the diffs to the server and refresh
 * TODO: send only the fpath diffs not the entire project
 */
function sendDiffs(data: TSendDiff) {
  const { fpath, doc, cid } = data
  logger.log('REPO: sendDiffs, cid, fpath', cid, fpath)
  const project = getProjectFromPath(fpath)
  if (!project) return this.emit('res:repo:file-saved')
  return CAWDiffs.sendDiffs(project, cid)
    .then(() => CAWDiffs.refreshChanges(project, project.activePath, doc, cid))
    .then(() => this.emit('res:repo:file-saved', project))
}

function cycleBlock(data: TContribBlock) {
  return CAWDiffs
    .cycleBlock(data)
    .then(diffs => this.emit('res:repo:cycle-block', diffs))
}

const repoController = {
  activatePath,
  add,
  addSubmodules,
  cycleBlock,
  diffWithBranch,
  diffWithPeer,
  getTmpDir,
  readFile,
  remove,
  sendDiffs,
  vscodeDiff,
}

export default repoController
