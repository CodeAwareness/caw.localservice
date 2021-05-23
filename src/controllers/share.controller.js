/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')
const { writeFile } = require('fs/promises')
const chokidar = require('chokidar')

const api = require('@/services/api')
const shell = require('@/services/shell')
const { Peer8Store } = require('@/services/peer8.store')
const catchAsync = require('@/utils/catchAsync')
const crypto = require('crypto')

const splitIntoGroups: any = catchAsync(async (req, res) => {
  const tmpDir = Peer8Store.tmpDir
  const { fpath, groups } = req.body
  const filename = path.basename(fpath)
  const extractDir = path.join(tmpDir, crypto.randomUUID())
  mkdirp.sync(extractDir)
  const zipFile = path.join(extractDir, `${filename}.zip`)
  await shell.copyFile(fpath, zipFile)
  const links = await api.shareFile({ zipFile, groups })
  /**
   * links = [{ origin, invitationLinks }, {...}, ...]
   */
  res.send(links)
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

const receiveShared: any = catchAsync(async (req, res) => {
  const { origin, folder } = req.body
  const tmpDir = Peer8Store.tmpDir
  const extractDir = path.join(tmpDir, crypto.randomUUID())
  mkdirp.sync(extractDir)

  let fpath
  return api.receiveShared(origin)
    .then(({ data, headers }) => {
      const filename = headers['Content-Disposition']?.split('filename=')[1]
      fpath = path.join(folder, filename)
      return writeFile(fpath, data)
    })
    .then(copyToWorkspace)
    .then(unzip)
    .then(monitorFile)

  function copyToWorkspace() {
    const filename = path.basename(fpath)
    const zipFile = path.join(extractDir, `${filename}.zip`)
    return shell.copyFile(fpath, zipFile)
  }

  function unzip() {
    const filename = path.basename(fpath)
    return shell.unzip(filename, extractDir)
  }

  function monitorFile() {
    chokidar.watch(fpath).on('change', refreshDiffs)
  }
})

function refreshDiffs(fpath) {
  console.log('File has been saved, refreshing diffs.')
  // TODO :send diffs to API (use repo sendDiffs)
}

module.exports = {
  receiveShared,
  splitIntoGroups,
}
