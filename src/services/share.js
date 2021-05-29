/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')
const chokidar = require('chokidar')
const crypto = require('crypto')
const fs = require('fs/promises')

const { EXTRACT_LOCAL_DIR } = require('@/config/config')
const api = require('@/services/api')
const shell = require('@/services/shell')
const diffs = require('@/services/diffs')
const { Peer8Store } = require('@/services/peer8.store')

async function startSharing({ fpath, groups }: any): any {
  const tmpDir = Peer8Store.tmpDir
  const wsFolder = path.join(tmpDir, crypto.randomUUID())
  const extractDir = path.join(wsFolder, EXTRACT_LOCAL_DIR)
  mkdirp.sync(extractDir)
  const zipFile = await copyToWorkspace({ fpath, extractDir })
  const res = await api.shareFile({ fpath, groups })
  const { origin, invitationLinks } = res
  await diffs.unzip(extractDir, zipFile)
  await diffs.initGit(extractDir, origin)
  monitorFile({ extractDir, fpath })
  await diffs.sendAdhocDiffs(wsFolder)

  return { wsFolder, origin, links: invitationLinks }
}

async function refreshDiffs({ extractDir, fpath }) {
  console.log('File has been saved, refreshing diffs.')
  await copyToWorkspace({ fpath, extractDir })
  await diffs.updateGit(extractDir)
  await diffs.sendAdhocDiffs(extractDir)
}

async function copyToWorkspace({ fpath, extractDir }) {
  return await shell.copyFile(fpath, extractDir)
}

function monitorFile({ fpath, extractDir }) {
  chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, extractDir })
    })
}

// TODO: when closing the PPT:
function unmonitorFile(fpath) {
  chokidar.unwatch(fpath)
}

async function receiveShared({ origin, folder }) {
  const tmpDir = Peer8Store.tmpDir
  const extractDir = path.join(tmpDir, crypto.randomUUID())
  mkdirp.sync(extractDir)

  let fpath
  return api.receiveShared(origin)
    .then(({ data, headers }) => {
      const filename = headers['content-disposition']?.split('filename=')[1].replace(/"/g, '')
      fpath = path.join(folder, filename)
      return fs.writeFile(fpath, data)
    })
    .then(() => {
      return copyToWorkspace({ fpath, extractDir })
    })
    .then(zipFile => {
      console.log('RECEIVED zipFile', zipFile)
      return diffs.unzip(extractDir, zipFile)
    })
    .then(() => {
      return diffs.initGit(extractDir, origin)
    })
    .then(() =>  {
      return monitorFile({ fpath, extractDir })
    })
}

async function buildPPTX({ extractDir, pptFilename }) {
  const zipFile = path.join(path.dirname(extractDir), pptFilename)
  await shell.zipToPPTX(zipFile, extractDir)
  return zipFile
}

async function fileToBase64(fpath) {
  return fs.readFile(fpath, { encoding: 'base64' })
}

module.exports = {
  buildPPTX,
  fileToBase64,
  receiveShared,
  startSharing,
  unmonitorFile,
}
