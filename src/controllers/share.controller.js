/* @flow */

const httpStatus = require('http-status')
const path = require('path')

// TODO: clear up this messed up tangled share/diffs code
const diffs = require('@/services/diffs')
const share = require('@/services/share')
const catchAsync = require('@/utils/catchAsync')
const { authStore, shareStore } = require('@/config/config')

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

/**
 * @param { fpath, origin, wsFolder }
 */
const setupReceived: any = catchAsync(async (req, res) => {
  console.log('setupReceived', req.body)
  const wsFolder = await share.setupReceived(req.body)
  res.send({ wsFolder })
})

const fileInfo: any = catchAsync(async (req, res) => {
  const filename = path.basename(req.query.f)
  if (!filename) return res.status(httpStatus.BAD_REQUEST).send()
  const { data } = await share.getFileInfo(filename)
  res.send(data)
})

const originInfo: any = catchAsync(async (req, res) => {
  const origin = req.query.origin
  if (!origin) return res.status(httpStatus.BAD_REQUEST).send()
  const { data } = await share.getOriginInfo(origin)
  console.log('origin info', data)
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
  const { origin, fpath } = req.body
  await shareStore.set('uid', user?._id)
  await shareStore.set('origin', origin)
  await shareStore.set('fpath', fpath)
  await shareStore.set('configDate', new Date())
  console.log('WILL OPEN PPT', origin)
})

const checkReceived: any = catchAsync(async (req, res) => {
  const uid        = await shareStore.get('uid')
  const origin     = await shareStore.get('origin')
  const fpath      = await shareStore.get('fpath')
  const configDate = new Date(await shareStore.get('configDate'))

  const user   = await authStore.get('user')
  const tokens = await authStore.get('tokens')

  console.log('checkReceived', origin, configDate, new Date() - configDate)

  if (new Date() - configDate < 60000) {
    return res.send({
      config: { origin, fpath, user, tokens },
    })
  }

  return res.send('')
})

const updateFilename: any = catchAsync(async (req, res) => {
  const { origin } = req.body
  share.unmonitorFile(origin)
  share.monitorFile(req.body)
})

module.exports = {
  checkReceived,
  getDiffs,
  fileInfo,
  originInfo,
  receiveShared,
  setupReceived,
  pptContributors,
  startSharing,
  updateFilename,
  uploadOriginal,
  willOpenPPT,
}
