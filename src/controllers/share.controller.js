/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')

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
  return links
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

module.exports = {
  splitIntoGroups,
}
