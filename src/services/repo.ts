import * as path from 'path'
import mkdirp from 'mkdirp'
import * as chokidar from 'chokidar'
import * as https from 'https'
import * as fs from 'node:fs/promises'
import { createWriteStream } from 'fs'

import Config from '@/config/config'
import { generateUUID } from '@/utils/string'
import shell from '@/services/shell'
import diffs from '@/services/diffs'
import { CΩStore } from '@/services/store'
import logger from '@/logger'

type TWebSocket = {
  wsFolder: string,
  origin: string,
}

function generateWSFolder() {
  const tmpDir = CΩStore.tmpDir
  return path.join(tmpDir, generateUUID(16))
}


/**
 * refreshDiffs
 * scope: GIT
 * desc : updates repo diffs and sends them to CodeAwareness
 */
async function refreshDiffs({ wsFolder, fpath, cΩ }) {
  logger.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit(extractDir)
  await diffs.sendAdhocDiffs(wsFolder, cΩ)
}

async function copyToWorkspace({ fpath, extractDir }) {
  return await shell.copyFile(fpath, extractDir)
}

type TLinks = {
  origin: string,
  links: Array<string>,
}

const cwatchers = {}
// TODO: create a hash table to not do double action when a file with the same name is downloaded in the same folder as before

/**
 * monitorFile
 * scope: PPT
 * desc : monitor a path for changes in the file
 *        this is necessary, because we don't have a good enough file change event system in PPT
 */
function monitorFile({ origin, fpath, wsFolder, cΩ }): void {
  logger.log('will monitor file', fpath, origin, wsFolder)
  cwatchers[origin] = chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, wsFolder, cΩ })
    })
}

/**
 * unmonitorOrigin
 * scope: PPT
 * desc : removes the PPT file from monitoring system
 */
function unmonitorOrigin(origin: string): void {
  cwatchers[origin]?.unwatch('*')
  // TODO: verify that when we're closing the PPT, we always sync latest changes from file system
}

const ShareService = {
  monitorFile,
  unmonitorOrigin,
}

export default ShareService
