import * as path from 'path'
import { readdirSync, stat } from 'node:fs'

import logger from '@/config/logger'
import git from './git'

import CAWStore from './store'

/**
 * @param data object {
 *   origin string - the URL for this repo (e.g. github.com/codeawareness/codeawareness.vscode.git)
 *   wsFolder string - the local folder path for this repo
 * }
 */
function getProject({ origin, wsFolder }): Array<any> {
  if (origin) {
    return CAWStore.projects.filter(m => m.origin === origin)[0]
  }
  if (wsFolder) {
    return CAWStore.projects.filter(m => m.root === wsFolder)[0]
  }
}

function isFolder(folder: string) {
  return new Promise((resolve, reject) => {
    stat(path.join(folder), (err, stats) => {
      if (stats.isDirectory()) resolve(true)
      else reject(err)
    })
  })
}

async function addProject(workspaceFolder: any): Promise<void> {
  logger.info('SCM addProject', workspaceFolder)
  const wsFolder = workspaceFolder.uri ? workspaceFolder.uri.path : workspaceFolder
  if (!await isFolder(path.join(wsFolder, '.git'))) {
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
      CAWStore.projects.push({ name, origin, root, changes, contributors })
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
  const project = CAWStore.projects.filter(m => m.name === wsFolder.name)[0]
  logger.info('SCM removeProject wsFolder', wsFolder, project)
  if (!project) return

  CAWStore.projects = CAWStore.projects.filter(m => m.origin !== project.origin)
}

function getFiles(source: string): string[] {
  return readdirSync(source, { withFileTypes: true })
    .filter(dirent => !dirent.isDirectory())
    .map(dirent => dirent.name)
}

/*
const clearProject = project => {
  CAWStore.scFiles[project.origin] = []
}
*/

/************************************************************************************
 * addFile = registerWithTDP
 *
 * DESIGN:
 * We're adding files to the CAW repository, but the user may have multiple repositories open, and we need to show diffs coresponding to multiple contributors.
 * Our CAW repository looks like this (where searchLib, microPost are just examples of repo names)

 * searchLib -> aliceId -> [ services/utils.js, main.js ]
 * searchLib -> bobId ->   [ services/logger.js, main.js ]
 * microPost -> bobId ->   [ settings/app.js, components/crispy.js ]

 * When we're adding files from downloadDiff, we store them in this format, and we combine all the file paths into a list for VSCode Source Control Manager.
 ************************************************************************************/
function addFile(wsFolder: any, fpath: string): void {
  const parts = fpath.split('/').filter(a => a)
  let prevObj = CAWStore.peerFS[wsFolder]
  if (!prevObj) prevObj = {}
  CAWStore.peerFS[wsFolder] = prevObj
  let leaf
  for (const name of parts) {
    if (!prevObj[name]) prevObj[name] = {}
    leaf = { name, prevObj }
    prevObj = prevObj[name]
  }
  leaf.prevObj[leaf.name] = 1
}

export const CAWSCM = {
  addProject,
  getProject,
  removeProject,
  removeSubmodules,
  addFile,
  getFiles,
}
