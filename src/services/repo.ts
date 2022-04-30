import * as path from 'path'
import mkdirp from 'mkdirp'
import * as chokidar from 'chokidar'
import * as https from 'https'
import * as fs from 'fs/promises'
import { createWriteStream } from 'fs'

import Config from '@/config/config'
import { generateUUID } from '@/utils/string'
import shell from '@/services/shell'
import diffs from '@/services/diffs'
import { CΩStore } from '@/services/cA.store'
import logger from '@/logger'

import api, { API_SHARE_UPLOAD } from '@/services/api'

type TWebSocket = {
  wsFolder: string,
  origin: string,
}

function generateWSFolder() {
  const tmpDir = CΩStore.tmpDir
  return path.join(tmpDir, generateUUID(16))
}

/**
 * uploadOriginal
 * scope: GIT
 * desc : repos diffs are sent to CodeAwareness
 */
async function uploadOriginal({ fpath, origin }): Promise<TWebSocket> {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  const zipFile = await copyToWorkspace({ fpath, extractDir })
  const promises = []
  promises.push(api.shareFile({ zipFile: fpath, origin }))
  promises.push(diffs.unzip({ extractDir, zipFile }))
  return Promise.all(promises)
    .then(() => {
      return diffs.initGit({ extractDir, origin })
    })
    .then(() => {
      return diffs.sendAdhocDiffs(wsFolder)
    })
    .then(() => {
      monitorFile({ origin, wsFolder, fpath })
    })
    .then(() => {
      return { wsFolder, origin }
    })
}

/**
 * refreshDiffs
 * scope: GIT
 * desc : updates repo diffs and sends them to CodeAwareness
 */
async function refreshDiffs({ wsFolder, fpath }) {
  logger.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit(extractDir)
  await diffs.sendAdhocDiffs(wsFolder)
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
function monitorFile({ origin, fpath, wsFolder }): void {
  logger.log('will monitor file', fpath, origin, wsFolder)
  cwatchers[origin] = chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, wsFolder })
    })
}

/**
 * downloadPPT
 * scope: PPT
 * desc : receive a byte array (the zip) representing the PPT file, saves and extracts in workspace
 */
async function downloadPPT(data): Promise<string> {
  const buffer = new Uint8Array(data.fileData)
  const fpath = await api.post(API_SHARE_UPLOAD, { url: data.fpath })
  return new Promise((resolve, reject) => {
    // @ts-ignore
    fs.writeFile(fpath, buffer, err => {
      if (err) {
        logger.error(err)
        reject(new Error(`Could not write PPT to workspace: ${fpath}`))
      }
      resolve(fpath)
    })
  })
}

/**
 * startSharing
 * scope: PPT
 * desc : create groups of users to share the PPT file with
 */
async function startSharing(groups: string[]): Promise<TLinks> {
  logger.info('share.ts:startSharing groups', groups)
  const data = await api.setupShare(groups)
  logger.log('got origin and links', data)
  return data
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

/**
 * acceptShare
 * scope: PPT
 * desc : accept an invite link, download the PPT file
 */
async function acceptShare(origin: string): Promise<string> {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  let fpath: string
  return api.acceptShare(origin)
    .then(res => {
      const parts = res.data.url.split('/')
      const filename = parts[parts.length - 1].replace(/\?.*$/, '')
      fpath = path.join(extractDir, filename)
      const file = createWriteStream(fpath)
      https.get(res.data.url, response => response.pipe(file))
      return new Promise((resolve, reject) => {
        file.on('close', resolve)
        file.on('end', resolve)
        file.on('error', reject)
      })
    })
    .then(() => {
      return fpath
    })
}

/**
 * setupReceived
 * scope: PPT
 * desc : extract the PPT (zip) file, setup contributors and monitoring
 */
function setupReceived({ fpath, origin, wsFolder }: any): Promise<any> {
  wsFolder = wsFolder || generateWSFolder()
  logger.log('setup received file', wsFolder, fpath, origin)
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  logger.log('setup received file', extractDir, fpath, origin)
  mkdirp.sync(extractDir)
  if (!fpath) return Promise.resolve()

  return copyToWorkspace({ fpath, extractDir })
    .then(zipFile => {
      return diffs.unzip({ extractDir, zipFile })
    })
    .then(() => {
      return diffs.initGit({ extractDir, origin })
    })
    .then(() =>  {
      monitorFile({ origin, fpath, wsFolder })
      return { fpath, wsFolder }
    })
}

/**
 * buildPPTX
 * scope: PPT
 * desc : creates a new PPTX file (zip) from the workspace
 */
async function buildPPTX({ extractDir, pptFilename }) {
  const zipFile = path.join(path.dirname(extractDir), pptFilename)
  await shell.zipToPPTX(zipFile, extractDir)
  return zipFile
}

async function fileToBase64(fpath: string): Promise<string> {
  return fs.readFile(fpath, { encoding: 'base64' })
}

async function getFileOrigin(fpath: string): Promise<any> {
  return await api.getFileOrigin(fpath)
}

async function getOriginInfo(origin: string): Promise<any> {
  return await api.getOriginInfo(origin)
}

async function createWorkspace(fpath) {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  return extractDir
}

const ShareService = {
  acceptShare,
  buildPPTX,
  createWorkspace,
  downloadPPT,
  fileToBase64,
  getFileOrigin,
  getOriginInfo,
  monitorFile,
  setupReceived,
  startSharing,
  unmonitorOrigin,
  uploadOriginal,
}

export default ShareService
