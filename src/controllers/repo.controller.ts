import httpStatus from 'http-status'
import { existsSync } from 'fs'
import path from 'path'

import logger from '@/config/logger'
import catchAsync from '@/utils/catchAsync'

import git from '@/services/git'
import { Peer8Store } from '@/services/peer8.store'

const add = catchAsync(async (req, res) => {
  const { folder } = req.body
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
  return git.gitRemotes(folder)
    .then(origin => {
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = folder
      const name = path.basename(root)
      // TODO: cleanup Peer8Store.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, contributors }
      Peer8Store.projects.push(project)
      res.send(project)
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
})

const remove = catchAsync(async (req, res) => {
  const { folder } = req.body
  const project = Peer8Store.projects.filter(m => m.name === path.basename(folder))[0]
  logger.info('SCM removeProject folder', folder, project)
  if (project) {
    Peer8Store.projects = Peer8Store.projects.filter(m => m.origin !== project.origin)
  }
  res.send(httpStatus.OK)
})

const addSubmodules = catchAsync(async (req, res) => {
  const { folder } = req.body
  // TODO: add submodules of submodules ? (recursive)
  return git.gitCommand(folder, 'git submodule status')
    .then(out => {
      if (!out) return
      const subs = []
      out.split('\n').map(line => {
        const res = / ([^\s]+) ([^\s]+) /.exec(line)
        if (res) subs.push(res[2])
      })
      logger.log('SCM git submodules: ', out, subs)
      subs.map(sub => {
        return add(
          path.join(folder, sub)
        )
      })
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
})

const removeSubmodules = catchAsync(async (req, res) => {
  const { folder } = req.body
  return git.gitCommand(folder, 'git submodule status')
    .then(out => {
      const subs = out.split('\n').map(line => / ([^\s]+) /.exec(line)[1])
      subs.map(sub => remove(path.join(folder, sub)))
    })
})

const repoController = {
  add,
  addSubmodules,
  remove,
  removeSubmodules,
}

export default repoController
