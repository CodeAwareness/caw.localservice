/* @flow */

const httpStatus = require('http-status')

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

module.exports = {
  getDiffs,
  receiveShared,
  setupReceived,
  pptContributors,
  startSharing,
  uploadOriginal,
}
