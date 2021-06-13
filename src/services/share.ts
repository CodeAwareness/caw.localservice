import * as path from 'path'
import mkdirp from 'mkdirp'
import * as chokidar from 'chokidar'
import * as https from 'https'
import * as fs from 'fs/promises'
import { createWriteStream } from 'fs'

import Config from '../config/config'
import { generateUUID } from '../utils/string'
import api from '../services/api'
import shell from '../services/shell'
import diffs from '../services/diffs'
import { Peer8Store } from '../services/peer8.store'

type TypeWS = {
  wsFolder: string,
  origin: string,
}

function generateWSFolder() {
  const tmpDir = Peer8Store.tmpDir
  return path.join(tmpDir, generateUUID(16))
}

async function uploadOriginal({ fpath, origin }): Promise<TypeWS> {
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

type TypeLinks = {
  origin: string,
  links: Array<string>,
}

async function startSharing(groups): Promise<TypeLinks> {
  const { origin, invitationLinks } = await api.setupShare(groups)
  return { origin, links: invitationLinks }
}

async function refreshDiffs({ wsFolder, fpath }) {
  console.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit(extractDir)
  await diffs.sendAdhocDiffs(wsFolder)
}

async function copyToWorkspace({ fpath, extractDir }) {
  return await shell.copyFile(fpath, extractDir)
}

// TODO: create a hash table to not do double action when a file with the same name is downloaded in the same folder as before
const cwatchers = {}
function monitorFile({ origin, fpath, wsFolder }): void {
  console.log('will monitor file', fpath, origin, wsFolder)
  cwatchers[origin] = chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, wsFolder })
    })
}

// TODO: when closing the PPT:
function unmonitorOrigin(origin: string): any {
  cwatchers[origin]?.unwatch('*')
}

async function acceptShare({ origin }: any): Promise<any> {
  const wsFolder = generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  let fpath
  console.log('WILL ACCEPT SHARE', origin)
  return api.acceptShare(origin)
    .then(({ data }) => {
      console.log('received shared URL', data)
      const parts = data.url.split('/')
      const filename = parts[parts.length - 1].replace(/\?.*$/, '')
      fpath = path.join(extractDir, filename)
      console.log('WRITE S3 Stream to', fpath)
      const file = createWriteStream(fpath)
      https.get(data.url, (response: any) => response.pipe(file))
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

function setupReceived({ fpath, origin, wsFolder }: any): Promise<any> {
  wsFolder = wsFolder || generateWSFolder()
  const extractDir = path.join(wsFolder, Config.EXTRACT_LOCAL_DIR)
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

async function buildPPTX({ extractDir, pptFilename }) {
  const zipFile = path.join(path.dirname(extractDir), pptFilename)
  await shell.zipToPPTX(zipFile, extractDir)
  return zipFile
}

async function fileToBase64(fpath: string): Promise<string> {
  return fs.readFile(fpath, { encoding: 'base64' })
}

async function getFileInfo(fpath: string): Promise<any> {
  return await api.getFileInfo(fpath)
}

async function getOriginInfo(origin: string): Promise<any> {
  return await api.getOriginInfo(origin)
}

const ShareService = {
  acceptShare,
  buildPPTX,
  getFileInfo,
  fileToBase64,
  getOriginInfo,
  monitorFile,
  setupReceived,
  startSharing,
  unmonitorOrigin,
  uploadOriginal,
}

export default ShareService
