import httpStatus from 'http-status'
import * as path from 'path'

// TODO: clear up this messed up tangled share/diffs code
import diffs from '../services/diffs'
import share from '../services/share'
import catchAsync from '../utils/catchAsync'
import { authStore, shareStore } from '../config/config'

const uploadOriginal = catchAsync(async (req, res) => {
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

const startSharing = catchAsync(async (req, res) => {
  /**
   * links = [{ origin, invitationLinks }, {...}, ...]
   */
  try {
    const data = await share.startSharing(req.body.groups)
    res.send(data)
  } catch (err) {
    console.error('startSharing op failure', err)
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send()
  }
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

const receiveShared = catchAsync(async (req, res) => {
  const peerFile = await share.receiveShared(req.body)
  const peerFile64 = await share.fileToBase64(peerFile)
  res.send({ peerFile, peerFile64 })
})

/**
 * @param { fpath, origin, wsFolder }
 */
const setupReceived = catchAsync(async (req, res) => {
  const wsFolder = await share.setupReceived(req.body)
  res.send({ wsFolder })
})

const fileInfo = catchAsync(async (req, res) => {
  const filename = path.basename(req.query.f)
  if (!filename) return res.status(httpStatus.BAD_REQUEST).send()
  const { data } = await share.getFileInfo(filename)
  res.send(data)
})

const originInfo = catchAsync(async (req, res) => {
  const origin = req.query.origin
  if (!origin) return res.status(httpStatus.BAD_REQUEST).send()
  const { data } = await share.getOriginInfo(origin)
  console.log('origin info', data)
  res.send(data)
})

const getDiffs = catchAsync(async (req, res) => {
  const { origin, ct, fpath, wsFolder } = req.body
  const userFile = fpath
  const { extractDir } = await diffs.diffWithContributor({ ct, origin, userFile, wsFolder })
  const pptFilename = `${ct._id}.pptx`
  const peerFile = await share.buildPPTX({ extractDir, pptFilename })
  const peerFile64 = await share.fileToBase64(peerFile)
  res.send({ peerFile64 })
})

const willOpenPPT = catchAsync(async (req, res) => {
  const { user } = req
  const { origin, fpath } = req.body
  await shareStore.set('uid', user?._id)
  await shareStore.set('origin', origin)
  await shareStore.set('fpath', fpath)
  await shareStore.set('configDate', new Date())
  console.log('WILL OPEN PPT', origin)
  res.status(httpStatus.OK).send()
})

const checkReceived = catchAsync(async (req, res) => {
  const origin     = await shareStore.get('origin')
  const fpath      = await shareStore.get('fpath')
  const configDate = new Date(await shareStore.get('configDate'))

  const user   = await authStore.get('user')
  const tokens = await authStore.get('tokens')

  /* @ts-ignore */
  const timediff = new Date() - configDate
  console.log('checkReceived', origin, configDate, timediff)

  if (timediff < 60000) {
    return res.send({
      config: { origin, fpath, user, tokens },
    })
  }

  return res.send('')
})

const updateFilename = catchAsync(async (req, res) => {
  const { origin } = req.body
  share.unmonitorOrigin(origin)
  share.monitorFile(req.body)
  res.status(httpStatus.OK).send()
})

const pptContributors = catchAsync(async (req, res) => {
  const { origin, fpath } = req.query
  const contributors = await diffs.refreshAdhocChanges({ origin, fpath })
  res.send(contributors)
})

const ShareController = {
  checkReceived,
  getDiffs,
  fileInfo,
  originInfo,
  pptContributors,
  receiveShared,
  setupReceived,
  startSharing,
  updateFilename,
  uploadOriginal,
  willOpenPPT,
}

export default ShareController
