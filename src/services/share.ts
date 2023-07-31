import * as path from 'path'
import mkdirp from 'mkdirp'
import * as chokidar from 'chokidar'
import * as https from 'https'
import * as fs from 'fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'

import Config from '@/config/config'
import { generateUUID } from '@/utils/string'
import shell from '@/services/shell'
import diffs from '@/services/diffs'
import CAWStore from '@/services/store'
import logger from '@/logger'

import CAWAPI, { API_SHARE_ACCEPT, API_SHARE_FINFO, API_SHARE_OINFO, API_SHARE_UPLOAD } from '@/services/api'

type TWebSocket = {
  wsFolder: string,
  origin: string,
}

function generateWSFolder() {
  const tmpDir = CAWStore.tmpDir
  return path.join(tmpDir, generateUUID(16))
}

/**
 * refreshDiffs
 * scope: GIT
 * desc : updates repo diffs and sends them to CodeAwareness
 */
async function refreshDiffs({ wsFolder, fpath /* , caw */ }) {
  logger.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit()
  // await diffs.sendAdhocDiffs(wsFolder, caw)
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
  const fpath = await CAWAPI.axiosAPI.post(API_SHARE_UPLOAD, { url: data.fpath }).then(res => res.data)
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
 *
 * @params { origin, groups }
 *
 * @return [url] links
 */
async function startSharing({ origin, groups }): Promise<TLinks> {
  const zipForm = new FormData()
  zipForm.append('origin', origin)
  zipForm.append('groups', JSON.stringify(groups))
  logger.log('Now reading file', origin)
  // @ts-ignore
  zipForm.append('file', createReadStream(origin), { filename: origin }) // !! the file has to be last appended to formdata
  logger.log('UPLOADING FILE', origin)
  return CAWAPI.axiosAPI
    .post(API_SHARE_UPLOAD, zipForm,
      {
        // @ts-ignore
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    .then(res => res.data)
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

type SHARE_URL_TYPE = {
  url: string,
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
  const uri = encodeURIComponent(origin)
  return CAWAPI.axiosAPI
    .get<SHARE_URL_TYPE>(`${API_SHARE_ACCEPT}?origin=${uri}`)
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
 * desc : extract the PPT (zip) file, setup peers and monitoring
 */
function setupReceived({ fpath, origin, wsFolder, caw }: any): Promise<any> {
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
  const uri = encodeURIComponent(fpath)
  return CAWAPI.axiosAPI(`${API_SHARE_FINFO}?fpath=${uri}`, { method: 'GET', responseType: 'json' })
}

async function getOriginInfo(origin: string): Promise<any> {
  const uri = encodeURIComponent(origin)
  return CAWAPI.axiosAPI(`${API_SHARE_OINFO}?origin=${uri}`, { method: 'GET', responseType: 'json' })
}

async function createWorkspace() {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  return extractDir
}

/**
 * uploadOriginal
 * scope: GIT
 * desc : repos diffs are sent to CodeAwareness
 */
async function uploadOriginal({ fpath, origin, caw }): Promise<TWebSocket> {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  const zipFile = await copyToWorkspace({ fpath, extractDir })
  const promises = []
  promises.push(diffs.unzip({ extractDir, zipFile }))
  return Promise.all(promises)
    .then(() => {
      return diffs.initGit({ extractDir, origin })
    })
    .then(() => {
      // return diffs.sendAdhocDiffs(wsFolder, caw)
    })
    .then(() => {
      monitorFile({ origin, wsFolder, fpath })
    })
    .then(() => {
      return { wsFolder, origin }
    })
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
