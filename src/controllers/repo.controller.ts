import { existsSync, mkdirSync } from 'fs'
import path from 'path'

import logger from '@/config/logger'

import app from '@/app'
import git from '@/services/git'
import { CΩStore } from '@/services/store'

type TRepoAddReq = {
  folder: string
  cΩ: string // the VSCode guid (supporting multiple instances of VSCode)
}

function add({ folder, cΩ }: TRepoAddReq) {
  logger.info('SCM addProject', folder)
  const hasGit = existsSync(path.join(folder, '.git'))
  if (!hasGit) {
    logger.log('SCM Not a git folder', folder)
    return Promise.resolve() // TODO: maybe allow other source control tools, besides git?
  }
  // TODO: pull changes to local workspace
  // Setup project origins
  const contributors = {}
  const changes = {}
  return git.getRemotes(folder)
    .then(origin => {
      const existing = CΩStore.projects.filter(p => p.origin === origin)
      if (existing) {
        this.emit('res:repo:add', { project: existing })
        return
      }
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = folder
      const name = path.basename(root)
      // TODO: cleanup CΩStore.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, contributors }
      CΩStore.projects.push(project)
      this.emit('res:repo:add', { project })
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
    const uPath = path.join(CΩStore.tmpDir, cΩ)
    mkdirSync(uPath)
    CΩStore.uTmpDir[cΩ] = uPath
    logger.info('GARDENER: created temp dir', uPath)
  }

  this.emit('res:repo:get-tmp-dir', CΩStore.uTmpDir[cΩ])
}

const repoController = {
  add,
  addSubmodules,
  getTmpDir,
  remove,
  removeSubmodules,
}

export default repoController
