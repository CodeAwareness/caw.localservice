/* @flow */

const httpStatus = require('http-status')
const { basename } = require('path')

const logger = require('@/config/logger')
const catchAsync = require('@/utils/catchAsync')

const path = require('path')
const { existsSync, readdirSync } = require('fs/promises')
const git = require('@/services/git')
const { Peer8Store } = require('@/services/peer8.store')

const add: any = catchAsync(async (req, res) => {
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
      const name = basename(root)
      // TODO: cleanup Peer8Store.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, contributors }
      Peer8Store.projects.push(project)
      res.send(project)
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
})

const remove: any = catchAsync(async (req, res) => {
  const { folder } = req.body
  const project = Peer8Store.projects.filter(m => m.name === basename(folder))[0]
  logger.info('SCM removeProject folder', folder, project)
  if (project) {
    Peer8Store.projects = Peer8Store.projects.filter(m => m.origin !== project.origin)
  }
  res.send(httpStatus.OK)
})

const addSubmodules: any = catchAsync(async (req, res) => {
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
      subs.map(sub => add(path.join(folder, sub)))
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
})

const removeSubmodules: any = catchAsync(async (req, res) => {
  const { folder } = req.body
  return git.gitCommand(folder, 'git submodule status')
    .then(out => {
      const subs = out.split('\n').map(line => / ([^\s]+) /.exec(line)[1])
      subs.map(sub => remove(path.join(folder, sub)))
    })
})

const getContributors: any = catchAsync(async (req, res) => {
})

const getRepo: any = catchAsync(async (req, res) => {
})

const getDiffFile: any = catchAsync(async (req, res) => {
})

const uploadDiffs: any = catchAsync(async (req, res) => {
})

const postCommitList: any = catchAsync(async (req, res) => {
})

const findCommonSHA: any = catchAsync(async (req, res) => {
})

const swarmAuth: any = catchAsync(async (req, res) => {
})

function announceRepoUpdateAvailable({ req, origin, sha, activePath, rid, user }) {
}

module.exports = {
  add,
  addSubmodules,
  announceRepoUpdateAvailable,
  getContributors,
  getDiffFile,
  getRepo,
  findCommonSHA,
  postCommitList,
  remove,
  removeSubmodules,
  swarmAuth,
  uploadDiffs,
}
