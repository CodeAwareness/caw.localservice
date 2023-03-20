import fs from 'node:fs'
import fsPromise from 'node:fs/promises'
import * as _ from 'lodash'
import path from 'path'
import type { Socket } from 'net'

import logger from '@/config/logger'
import config from '@/config/config'

import git from '@/services/git'
import { CAWStore } from '@/services/store'
import CAWDiffs from '@/services/diffs'

type TRepoAddReq = {
  folder: string
  caw: string // the VSCode guid (supporting multiple instances of VSCode)
}

type TRepoActivateReq = {
  fpath: string // activated file's path
  doc: string // activated file's content
  caw: string
}

// TODO: group CAWStore projects by caw value

async function activatePath(data: any): Promise<any> {
  const { fpath, caw, doc }: TRepoActivateReq = data
  if (!fpath) return
  logger.log('REPO: activate path (fpath, caw)', fpath, caw)
  if (fpath.toLowerCase().includes(CAWStore.tmpDir.toLowerCase())) return Promise.resolve() // active file is the temporary diff file

  /* select the project corresponding to the activated path; if there is no project matching, we add as new project */
  const project = await selectProject(fpath, caw, this)
  project.activePath = fpath

  /* next up: download changes from peers */
  return CAWDiffs
    .refreshChanges(project, project.activePath, doc, caw)
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
 * Select the current project for the caw client, and UPDATES the server with its latest DIFFS.
 * We look at the file that's activated and select the project that matches its path.
 *
 * @param string the file path for the current file open in the editor
 * @param string the client ID
 * @param object the web socket, used to reply when everything's done
 */
function selectProject(fpath: string, caw: string, socket: Socket): Promise<any> {
  let project = getProjectFromPath(fpath)
  const wsFolder = path.dirname(fpath)
  if (!project?.cSHA) {
    return git.command(wsFolder, 'git rev-parse --show-toplevel')
      .then(folder => add({ folder, caw }, socket))
      .then(newProject => {
        project = newProject
        project.activePath = fpath.substr(project.root)
        logger.info('REPO: the relative active path is', project.activeProjects)
        CAWStore.projects.push(project) // TODO: used for SCM, but we need to also use socket id caw
        CAWStore.activeProjects[caw] = project
        CAWDiffs.sendDiffs(project, caw) // Not waiting at the moment, because we're only returning OK from the server
        return git.command(wsFolder, 'git branch --no-color')
      })
      .then(stdout => {
        const lines = stdout.split('\n')
        project.branch = lines.filter(l => /^\*/.test(l))[0].substr(2)
        project.branches = lines.map(line => line.replace('* ', '').replace(/\s/g, '')).filter(a => a)
        return project
      })
  }
  CAWStore.activeProjects[caw] = project
  // TODO: send diffs on a timer? (for example when more than 5 minutes have passed)
  return Promise.resolve(project)
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
  const contributors = {}
  const changes = {}
  const ws = socket || this
  return git.getRemotes(folder)
    .then(origin => {
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
      const project = { name, origin, root, changes, contributors }
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

function addSubmodules({ folder, caw }: TRepoAddReq): Promise<void> {
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
      const promises = subs.map(sub => add({ folder: path.join(folder, sub), caw }))
      return Promise.all(promises)
        .then(projects => {
          this.emit('res:repo:add-submodules', projects)
        })
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
}

function getTmpDir({ caw }) {
  if (!CAWStore.uTmpDir[caw]) {
    console.log('GET TMP DIR', CAWStore.tmpDir, caw)
    const uPath = path.join(CAWStore.tmpDir, caw)
    fs.mkdirSync(uPath)
    CAWStore.uTmpDir[caw] = uPath
    logger.info('GARDENER: created temp dir', uPath)
  }

  this.emit('res:repo:get-tmp-dir', { tmpDir: CAWStore.uTmpDir[caw] })
}

type TBranchDiffInfo = {
  fpath: string
  branch: string
  origin: string
  caw: string
}

/**
 * @param info object { fpath, branch, origin, caw }
 */
function diffWithBranch(info: TBranchDiffInfo) {
  return CAWDiffs
    .diffWithBranch(info)
    .then(diffs => this.emit('res:repo:diff-branch', diffs))
}

type TContribDiffInfo = {
  fpath: string
  contrib: any
  origin: string
  caw: string
}

/**
 * @param info object { fpath, contrib, origin, caw }
 */
function diffWithContributor(info: TContribDiffInfo) {
  return CAWDiffs
    .diffWithContributor(info)
    .then(diffs => this.emit('res:repo:diff-contrib', diffs))
}

function readFile({ fpath }) {
  fsPromise.readFile(fpath).then(doc => doc.toString('utf8'))
}

function vscodeDiff({ wsFolder, fpath, uid, caw }) {
  const absPath = path.join(wsFolder, fpath)
  try {
    fs.accessSync(absPath, fs.constants.R_OK)
    this.emit('res:repo:vscode-diff', { exists: true, res1: path.join(wsFolder, fpath) })
  } catch (err) {
    const tmpDir = CAWStore.uTmpDir[caw]
    const activeProject = CAWStore.activeProjects[caw]
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
  caw: string
}

async function sendDiffs(data: TSendDiff) {
  const { fpath, doc, caw } = data
  const project = getProjectFromPath(fpath)
  await CAWDiffs.sendDiffs(project, caw)
  return CAWDiffs.refreshChanges(project, project.activePath, doc, caw)
    .then(() => {
      this.emit('res:repo:file-saved', project)
    })
}

const repoController = {
  activatePath,
  add,
  addSubmodules,
  diffWithBranch,
  diffWithContributor,
  getTmpDir,
  readFile,
  remove,
  sendDiffs,
  vscodeDiff,
}

export default repoController
