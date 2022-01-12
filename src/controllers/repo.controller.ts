import { existsSync } from 'fs'
import path from 'path'

import logger from '@/config/logger'

import app from '@/app'
import git from '@/services/git'
import { CΩStore } from '@/services/cA.store'

const add = folder => {
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
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = folder
      const name = path.basename(root)
      // TODO: cleanup CΩStore.projects with a timeout of inactivity or something
      const project = { name, origin, root, changes, contributors }
      CΩStore.projects.push(project)
      app.gardenerSocket.emit('repo:added', { project })
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
}

const remove = folder => {
  const project = CΩStore.projects.filter(m => m.name === path.basename(folder))[0]
  logger.info('SCM removeProject folder', folder, project)
  if (project) {
    CΩStore.projects = CΩStore.projects.filter(m => m.origin !== project.origin)
  }
  app.gardenerSocket.emit('repo:removed', { folder })
}

const addSubmodules = folder => {
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
      subs.map(sub => add(path.join(folder, sub)))
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
}

const removeSubmodules = folder => {
  return git.command(folder, 'git submodule status')
    .then(out => {
      const subs = out.split('\n').map(line => / ([^\s]+) /.exec(line)[1])
      subs.map(sub => remove(path.join(folder, sub)))
    })
}

const repoController = {
  add,
  addSubmodules,
  remove,
  removeSubmodules,
}

export default repoController
