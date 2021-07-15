import * as path from 'path'

// TODO: clear up this messed up tangled share/diffs code
import { authStore, shareStore } from '../config/config'
import root from '../app'
import diffs from '../services/diffs'
import share from '../services/share'
import wsEngine from '../middlewares/wsio'

const uploadOriginal = ({ fpath, origin }) => {
  share
    .uploadOriginal({ fpath, origin })
    .then(data => {
      root.rootSocket.emit('share:uploaded', { data })
    })
    .catch(err => {
      console.error('startSharing op failure', err)
      root.rootSocket.emit('error', { op: 'share:start:upload', err })
    })
  // TODO: unzip and create Files records, maybe?
  // await shell.unzip(path.basename(zipFile), extractDir)
}

/**
 * @param Object data = { origin, links }
 */
const startSharing = (data) => {
  share.startSharing(data.groups)
    .then(data => wsEngine.transmit('res:share:start', { data }))
    .catch(err => {
      console.error('startSharing op failure', err)
      root.rootSocket.emit('error', { op: 'share:start', err })
    })
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
}

const acceptShare = async origin => {
  const peerFile = await share.acceptShare(origin)
  const peerFile64 = await share.fileToBase64(peerFile)
  // TODO: this is potentially sending 200MB file to the server and then back
  root.rootSocket.emit('share:accepted', { peerFile, peerFile64 })
}

/**
 * @param { fpath, origin, wsFolder }
 */
const setupReceived = async data => {
  // data = { fpath, origin, wsFolder }
  const { fpath, wsFolder } = await share.setupReceived(data)
  root.rootSocket.emit('share:setupComplete', { fpath, wsFolder })
}

const getFileOrigin = fpath => {
  const filename = path.basename(fpath)
  if (!filename) {
    root.rootSocket.emit('error', { op: 'getFileOrigin', err: 'empty filename' })
  }
  share
    .getFileOrigin(filename)
    .then(res => {
      root.rootSocket.emit('share:setFileOrigin', res.data)
    })
}

const getOriginInfo = origin => {
  if (!origin) return root.rootSocket.emit('error', { op: 'getOriginInfo', err: 'empty origin' })
  share
    .getOriginInfo(origin)
    .then(res => {
      console.log('origin info', res.data)
      root.rootSocket.emit('share:setFileOrigin', res.data)
    })
}

const getDiffs = async ({ origin, ct, fpath, wsFolder }) => {
  const userFile = fpath
  const { extractDir } = await diffs.diffWithContributor({ ct, origin, userFile, wsFolder })
  const pptFilename = `${ct._id}.pptx`
  const peerFile = await share.buildPPTX({ extractDir, pptFilename })
  const peerFile64 = await share.fileToBase64(peerFile)
  root.rootSocket.emit('share:peerFile', peerFile64)
}

const willOpenPPT = async ({ user, origin, fpath }) => {
  await shareStore.set('uid', user?._id)
  await shareStore.set('origin', origin)
  await shareStore.set('fpath', fpath)
  await shareStore.set('configDate', new Date())
  console.log('WILL OPEN PPT', origin)
  root.rootSocket.emit('share:storeSet')
}

const checkReceived = async () => {
  const origin     = await shareStore.get('origin')
  const fpath      = await shareStore.get('fpath')
  const configDate = new Date(await shareStore.get('configDate'))

  const user   = await authStore.get('user')
  const tokens = await authStore.get('tokens')

  /* @ts-ignore */
  const timediff = new Date() - configDate
  console.log('checkReceived', origin, configDate, timediff)

  if (timediff < 60000) {
    root.rootSocket.emit('share:config', { origin, fpath, user, tokens })
  }

  root.rootSocket.emit('share:config', '')
}

const updateFilename = data => {
  // data = { origin, fpath, wsFolder }
  share.unmonitorOrigin(data.origin)
  share.monitorFile(data)
  root.rootSocket.emit('share:filenameUpdated')
}

const pptContributors = async ({ origin, fpath }) => {
  const contributors = await diffs.refreshAdhocChanges({ origin, fpath })
  root.rootSocket.emit('share:contributors', contributors)
}

const ShareController = {
  acceptShare,
  checkReceived,
  getDiffs,
  getFileOrigin,
  getOriginInfo,
  pptContributors,
  setupReceived,
  startSharing,
  updateFilename,
  uploadOriginal,
  willOpenPPT,
}

export default ShareController
