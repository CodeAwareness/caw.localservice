import * as path from 'path'
import * as chokidar from 'chokidar'

import Config from '@/config/config'
import CAWStore from '@/services/store'
import shell from '@/services/shell'
import diffs from '@/services/diffs'
import logger from '@/logger'

/**
 * refreshDiffs
 * scope: GIT
 * desc : updates repo diffs and sends them to CodeAwareness
 */
async function refreshDiffs({ wsFolder, fpath /*, caw */ }) {
  logger.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit()
  // await diffs.sendAdhocDiffs(wsFolder, caw)
}

async function copyToWorkspace({ fpath, extractDir }) {
  return await shell.copyFile(fpath, extractDir)
}

const cwatchers = {}
// TODO: create a hash table to not do double action when a file with the same name is downloaded in the same folder as before

/**
 * monitorFile
 * scope: SHARE
 * desc : monitor a path for changes in the file
 *        this is necessary, because we don't have a good enough file change event system in SHARE
 */
function monitorFile({ origin, fpath, wsFolder }): void {
  logger.log('will monitor file', fpath, origin, wsFolder)
  cwatchers[origin] = chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, wsFolder })
    })
}

/**
 * unmonitorOrigin
 * scope: SHARE
 * desc : removes the SHARE file from monitoring system
 */
function unmonitorOrigin(origin: string): void {
  cwatchers[origin]?.unwatch('*')
  // TODO: verify that when we're closing the SHARE, we always sync latest changes from file system
}

export function getProjectFromPath(fpath: string) {
  const plist = CAWStore.projects.filter(p => fpath.includes(p.root))
  let project: any
  let len = 0
  // select longest path to guarantee working properly even on git submodules
  plist.map(p => {
    if (p.root.length > len) project = p
    len = p.root.length
  })
  if (project) project.activePath = shell.getRelativePath(fpath, project)
  return project
}

const ShareService = {
  monitorFile,
  unmonitorOrigin,
}

export default ShareService
