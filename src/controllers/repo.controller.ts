import fs from 'node:fs'
import path from 'path'
import type { Socket } from 'socket.io'

import logger from '@/config/logger'

import app from '@/app'
import git from '@/services/git'
import { CΩStore } from '@/services/store'
import CΩDiffs from '@/services/diffs'

type TRepoAddReq = {
  folder: string
  cΩ: string // the VSCode guid (supporting multiple instances of VSCode)
}

type TRepoActivateReq = {
  fpath: string // activated file's path
  doc: string // activated file's content
  cΩ: string
}

// TODO: group CΩStore projects by cΩ value

async function activatePath(data: any): Promise<any> {
  const { fpath, cΩ, doc }: TRepoActivateReq = data
  logger.log('REPO: activate path (fpath, cΩ)', fpath, cΩ)
  if (fpath.toLowerCase().includes(CΩStore.tmpDir.toLowerCase())) return Promise.reject(new Error('file is temp'))

  /* select the project corresponding to the activated path; if there is no project matching, we add as new project */
  const project = await selectProject(fpath, cΩ, this)
  logger.log('REPO: activate path (project)', project)

  /* next up: download changes from peers */
  return CΩDiffs
    .refreshChanges(project, project.activePath, doc)
    .then(() => {
      this.emit('res:repo:active-path', project)
    })
}

/**
 * Select the current project for the cΩ client, and updates the server with its latest diffs.
 * We look at the file that's activated and select the project that matches its path.
 *
 * @param string the file path for the current file open in the editor
 * @param string the client ID
 * @param object the web socket, used to reply when everything's done
 */
function selectProject(fpath, cΩ, socket): Promise<any> {
  const plist = CΩStore.projects.filter(p => fpath.includes(p.root))
  let project
  let len = 0
  // select longest path to guarantee working properly even on git submodules
  plist.map(p => {
    if (p.root.length > len) project = p
    len = p.root.length
  })
  if (!project?.cSHA) {
    return git.command(path.dirname(fpath), 'git rev-parse --show-toplevel')
      .then(folder => add({ folder, cΩ }, socket))
      .then(project => {
        logger.info('REPO: the relative active path is', fpath.substr(project.root.length))
        project.activePath = fpath.substr(project.root)
        CΩStore.projects.push(project) // TODO: used for SCM, but we need to also use socket id cΩ
        CΩStore.activeProjects[cΩ] = project
        CΩDiffs.sendDiffs(project, cΩ)
        return project
      })
  }
  CΩStore.activeProjects[cΩ] = project
  console.log('CΩSTORE ACTIVE PROJECTS', cΩ, CΩStore.activeProjects)
  // TODO: send diffs if more than 5 minutes have passed
  return Promise.resolve(project)
}

function add(requested: TRepoAddReq, socket?: Socket): Promise<any> {
  const folder = requested.folder.trim()
  logger.info('REPO: addProject', folder)
  let hasGit
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
      const existing = CΩStore.projects.filter(p => p.origin === origin)[0]
      if (existing) {
        ws.emit('res:repo:add', { project: existing })
        return existing
      }
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = folder
      const name = path.basename(root)
      // TODO: cleanup CΩStore.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, contributors }
      logger.log('REPO: adding new project', project)
      ws.emit('res:repo:add', { project })
      return project
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
}

function remove({ folder, cΩ }: TRepoAddReq) {
  const project = CΩStore.projects.filter(m => m.name === path.basename(folder))[0]
  logger.info('SCM removeProject folder', folder, project)
  if (project) {
    CΩStore.projects = CΩStore.projects.filter(m => m.origin !== project.origin)
  }
  this.emit('res:repo:removed', { folder })
}

function addSubmodules({ folder, cΩ }: TRepoAddReq) {
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
      subs.map(sub => add.bind(this)({ folder: path.join(folder, sub), cΩ }))

      this.emit('res:repo:add-submodules', subs)
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
}

function removeSubmodules({ folder, cΩ }: TRepoAddReq) {
  return git.command(folder, 'git submodule status')
    .then(out => {
      const subs = out.split('\n').map(line => / ([^\s]+) /.exec(line)[1])
      subs.map(sub => remove({ folder: path.join(folder, sub), cΩ }))
    })
}

function getTmpDir({ cΩ }) {
  if (!CΩStore.uTmpDir[cΩ]) {
    console.log('GET TMP DIR', CΩStore.tmpDir, cΩ)
    const uPath = path.join(CΩStore.tmpDir, cΩ)
    fs.mkdirSync(uPath)
    CΩStore.uTmpDir[cΩ] = uPath
    logger.info('GARDENER: created temp dir', uPath)
  }

  this.emit('res:repo:get-tmp-dir', CΩStore.uTmpDir[cΩ])
}

/**
 * @param object { fpath, branch, origin, cΩ }
 */
function diffWithBranch(info) {
  return CΩDiffs
    .diffWithBranch(info)
    .then(diffs => this.emit('res:repo:diff-branch', diffs))
}

/**
 * @param object { fpath, contrib, origin, cΩ }
 */
function diffWithContributor(info) {
  return CΩDiffs
    .diffWithContributor(info)
    .then(diffs => this.emit('res:repo:diff-contrib', diffs))
}

const repoController = {
  activatePath,
  add,
  addSubmodules,
  diffWithBranch,
  diffWithContributor,
  getTmpDir,
  remove,
  removeSubmodules,
}

export default repoController
