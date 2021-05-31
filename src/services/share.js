/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')
const chokidar = require('chokidar')
const crypto = require('crypto')
// eslint-disable-next-line
const fs = require('fs/promises')

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
  promises.push(
    diffs.unzip(extractDir, zipFile)
      .then(() => {
        diffs.initGit(extractDir, origin)
      })
      .then(() => {
        diffs.sendAdhocDiffs(wsFolder)
      })
  )
  Promise.all(promises)
    .then(() => {
      monitorFile({ wsFolder, fpath })
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
function monitorFile({ fpath, wsFolder }) {
  chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, wsFolder })
    })
}

// TODO: when closing the PPT:
function unmonitorFile(fpath: string): any {
  chokidar.unwatch(fpath)
}

async function receiveShared({ origin, folder }: any): Promise<any> {
  let fpath
  return api.receiveShared(origin)
    .then(({ data, headers }) => {
      // $FlowIgnore
      // eslint-disable-next-line
      const filename = headers['content-disposition']?.split('filename=')[1].replace(/"/g, '')
      fpath = path.join(folder, filename)
      return fs.writeFile(fpath, data)
    })
    .then(() => {
      return fpath
    })
}

function setupReceived({ fpath, origin, wsFolder }) {
  const tmpDir = Peer8Store.tmpDir
  // $FlowIgnore
  // eslint-disable-next-line
  wsFolder = wsFolder || path.join(tmpDir, crypto.randomUUID())
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)

  return copyToWorkspace({ fpath, extractDir })
    .then(zipFile => {
      return diffs.unzip({ extractDir, zipFile })
    })
    .then(() => {
      return diffs.initGit({ extractDir, origin })
    })
    .then(() =>  {
      monitorFile({ fpath, wsFolder })
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

module.exports = {
  buildPPTX,
  fileToBase64,
  receiveShared,
  setupReceived,
  startSharing,
  unmonitorFile,
  uploadOriginal,
}
