/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')
const chokidar = require('chokidar')
const crypto = require('crypto')
const https = require('https')
// eslint-disable-next-line
const fs = require('fs/promises')
const { createWriteStream, mkdirSync } = require('fs')

const { EXTRACT_LOCAL_DIR } = require('@/config/config')
const api = require('@/services/api')
const shell = require('@/services/shell')
const diffs = require('@/services/diffs')
const { Peer8Store } = require('@/services/peer8.store')

async function uploadOriginal({ fpath, origin }: any): any {
  const tmpDir = Peer8Store.tmpDir
  // eslint-disable-next-line
  // $FlowIgnore
  const wsFolder = path.join(tmpDir, crypto.randomUUID())
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  const zipFile = await copyToWorkspace({ fpath, extractDir })
  const promises = []
  promises.push(api.shareFile({ zipFile: fpath, origin }))
  promises.push(diffs.unzip({ extractDir, zipFile }))
  Promise.all(promises)
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

async function startSharing({ fpath, groups }: any): any {
  const { origin, invitationLinks } = await api.setupShare(groups)
  return { origin, links: invitationLinks }
}

async function refreshDiffs({ wsFolder, fpath }) {
  console.log('File has been saved, refreshing diffs.')
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit(extractDir)
  await diffs.sendAdhocDiffs(wsFolder)
}

async function copyToWorkspace({ fpath, extractDir }) {
  return await shell.copyFile(fpath, extractDir)
}

// TODO: create a hash table to not do double action when a file with the same name is downloaded in the same folder as before
const cwatchers = {}
function monitorFile({ origin, fpath, wsFolder }) {
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

async function receiveShared({ origin }: any): Promise<any> {
  const tmpDir = Peer8Store.tmpDir
  const wsFolder = path.join(tmpDir, crypto.randomUUID())
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  let fpath
  return api.receiveShared(origin)
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
  const tmpDir = Peer8Store.tmpDir
  // $FlowIgnore
  // eslint-disable-next-line
  wsFolder = wsFolder || path.join(tmpDir, crypto.randomUUID())
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
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

async function fileToBase64(fpath: string): any {
  return fs.readFile(fpath, { encoding: 'base64' })
}

async function getFileInfo(fpath: string): Promise<any> {
  return await api.getFileInfo(fpath)
}

async function getOriginInfo(origin: string): Promise<any> {
  return await api.getOriginInfo(origin)
}

module.exports = {
  buildPPTX,
  getFileInfo,
  fileToBase64,
  getOriginInfo,
  receiveShared,
  setupReceived,
  startSharing,
  unmonitorFile,
  uploadOriginal,
}
