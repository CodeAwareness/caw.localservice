import * as path from 'path'
import fs from 'node:fs'

import logger from '@/config/logger'
import git from './git'

import { CΩStore } from './store'

/**
 * @param string origin (OR) - the URL for this repo (e.g. github.com/codeawareness/codeawareness.vscode.git)
 * @param string wsFolder (OR) - the local folder path for this repo
 */
function getProject({ origin, wsFolder }): Array<any> {
  if (origin) {
    return CΩStore.projects.filter(m => m.origin === origin)[0]
  }
  if (wsFolder) {
    return CΩStore.projects.filter(m => m.root === wsFolder)[0]
  }
}

async function addSubmodules(workspaceFolder: any): Promise<void> {
  // TODO: add submodules of submodules ? (recursive)
  const wsFolder = workspaceFolder.uri ? workspaceFolder.uri.path : workspaceFolder
  return git.command(wsFolder, 'git submodule status')
    .then(out => {
      if (!out) return
      const subs = []
      out.split('\n').map(line => {
        const res = / ([^\s]+) ([^\s]+) /.exec(line)
        if (res) subs.push(res[2])
      })
      logger.log('SCM git submodules: ', out, subs)
      subs.map(sub => addProject(path.join(wsFolder, sub)))
    })
    .catch(err => {
      logger.error('SCM git submodule error', err)
    })
}

function addProject(workspaceFolder: any): Promise<void> {
  logger.info('SCM addProject', workspaceFolder)
  const wsFolder = workspaceFolder.uri ? workspaceFolder.uri.path : workspaceFolder
  const hasGit = fs.existsSync(path.join(wsFolder, '.git'))
  if (!hasGit) {
    logger.log('SCM Not a git folder', wsFolder)
    return Promise.resolve() // TODO: maybe allow other source control tools, besides git?
  }
  const contributors = {}
  const changes = {}

  // TODO: pull changes to local workspace
  // Setup project origins
  return git.getRemotes(wsFolder)
    .then(origin => {
      // TODO: Allow other versioning systems (gitlab, etc)
      // TODO: Check all remotes (check if ANY match)
      const root = wsFolder
      const name = path.basename(root)
      CΩStore.projects.push({ name, origin, root, changes, contributors })
    })
    .catch(err => logger.error('SCM setupOrigin ERROR', err))
}

async function removeSubmodules(workspaceFolder: any): Promise<void> {
  const wsFolder = workspaceFolder.uri ? workspaceFolder.uri.path : workspaceFolder
  return git.command(wsFolder, 'git submodule status')
    .then(out => {
      if (!out.trim()) return
      const subs = out.split('\n').map(line => / ([^\s]+) /.exec(line)[1])
      subs.map(sub => removeProject(path.join(wsFolder, sub)))
    })
}

function removeProject(wsFolder: any): void {
  const project = CΩStore.projects.filter(m => m.name === wsFolder.name)[0]
  logger.info('SCM removeProject wsFolder', wsFolder, project)
  if (!project) return

  CΩStore.projects = CΩStore.projects.filter(m => m.origin !== project.origin)
}

/**
 * CΩ SCM only has one resource group, which contains all changes.
 * There are no commits, as we always handle merging manually.
 */
function createProjects({ folders }): Promise<Array<any>> {
  if (!folders) return Promise.resolve(CΩStore.projects)
  const promises = folders.map(addProject)
  promises.concat(folders.map(addSubmodules))
  return Promise.all(promises)
    .then(() => CΩStore.projects)
}

function getFiles(source: string): string[] {
  return fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => !dirent.isDirectory())
    .map(dirent => dirent.name)
}

/*
const clearProject = project => {
  CΩStore.scFiles[project.origin] = []
}
*/

/************************************************************************************
 * addFile = registerWithTDP
 *
 * DESIGN:
 * We're adding files to the CΩ repository, but the user may have multiple repositories open, and we need to show diffs coresponding to multiple contributors.
 * Our CΩ repository looks like this (where searchLib, microPost are just examples of repo names)

 * searchLib -> aliceId -> [ services/utils.js, main.js ]
 * searchLib -> bobId ->   [ services/logger.js, main.js ]
 * microPost -> bobId ->   [ settings/app.js, components/crispy.js ]

 * When we're adding files from downloadDiff, we store them in this format, and we combine all the file paths into a list for VSCode Source Control Manager.
 ************************************************************************************/
function addFile(wsFolder: any, fpath: string): void {
  const parts = fpath.split('/').filter(a => a)
  let prevObj = CΩStore.peerFS[wsFolder]
  if (!prevObj) prevObj = {}
  CΩStore.peerFS[wsFolder] = prevObj
  let leaf
  for (const name of parts) {
    if (!prevObj[name]) prevObj[name] = {}
    leaf = { name, prevObj }
    prevObj = prevObj[name]
  }
  leaf.prevObj[leaf.name] = 1
}

export const CΩSCM = {
  addProject,
  addSubmodules,
  getProject,
  createProjects,
  removeProject,
  removeSubmodules,
  addFile,
  getFiles,
}
