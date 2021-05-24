/* @flow */

const httpStatus = require('http-status')

// TODO: clear up this messed up tangled share/diffs code
const diffs = require('@/services/diffs')
const share = require('@/services/share')
const catchAsync = require('@/utils/catchAsync')

const splitIntoGroups: any = catchAsync(async (req, res) => {
  /**
   * links = [{ origin, invitationLinks }, {...}, ...]
   */
  const links = share.splitIntoGroups(req.body)
  res.send(links)
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

const receiveShared: any = catchAsync(async (req, res) => {
  await share.receiveShared(req.body)
  res.status(httpStatus.OK).send()
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
  pptContributors,
  splitIntoGroups,
}
