/* @flow */

const httpStatus = require('http-status')
const path = require('path')
const Keyv = require('keyv')

const dbpath = path.join(process.cwd(), 'storage.sqlite')
const keyv = new Keyv(`sqlite://${dbpath}`, { namespace: 'share' })
keyv.on('error', err => console.error('SQLite storage: connection error', err))

// TODO: clear up this messed up tangled share/diffs code
const diffs = require('@/services/diffs')
const share = require('@/services/share')
const catchAsync = require('@/utils/catchAsync')

const uploadOriginal: any = catchAsync(async (req, res) => {
  try {
    const data = await share.uploadOriginal(req.body)
    res.send(data)
  } catch (err) {
    console.error('startSharing op failure', err)
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send()
  }
  // TODO: unzip and create Files records, maybe?
  // await shell.unzip(path.basename(zipFile), extractDir)
})

const startSharing: any = catchAsync(async (req, res) => {
  /**
   * links = [{ origin, invitationLinks }, {...}, ...]
   */
  try {
    const data = await share.startSharing(req.body)
    res.send(data)
  } catch (err) {
    console.error('startSharing op failure', err)
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send()
  }
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

const receiveShared: any = catchAsync(async (req, res) => {
  const peerFile = await share.receiveShared(req.body)
  const peerFile64 = await share.fileToBase64(peerFile)
  res.send({ peerFile, peerFile64 })
})

const setupReceived: any = catchAsync(async (req, res) => {
  const wsFolder = await share.setupReceived(req.body)
  res.send({ wsFolder })
})

const fileInfo: any = catchAsync(async (req, res) => {
  const filename = path.basename(req.query.f)
  if (!filename) return res.status(httpStatus.BAD_REQUEST).send()
  const data = await share.getFileInfo(filename)
  console.log('fileInfo', data)
  res.send(data)
})

const pptContributors: any = catchAsync(async (req, res) => {
  const contributors = await diffs.refreshAdhocChanges(req.body)
  res.send(contributors)
})

const getDiffs: any = catchAsync(async (req, res) => {
  const { origin, ct, fpath, wsFolder } = req.body
  const userFile = fpath
  const { extractDir } = await diffs.diffWithContributor({ ct, origin, userFile, wsFolder })
  const pptFilename = `${ct._id}.pptx`
  const peerFile = await share.buildPPTX({ extractDir, pptFilename })
  const peerFile64 = await share.fileToBase64(peerFile)
  res.send({ peerFile64 })
})

const willOpenPPT: any = catchAsync(async (req, res) => {
  const { user } = req
  await keyv.set('uid', user?._id)
})

const checkReceived: any = catchAsync(async (req, res) => {
  const { user } = req
  const config = await keyv.get('uid', user?._id)
})

module.exports = {
  getDiffs,
  fileInfo,
  receiveShared,
  setupReceived,
  pptContributors,
  startSharing,
  uploadOriginal,
  willOpenPPT,
}
