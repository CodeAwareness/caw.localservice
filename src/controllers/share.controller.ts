import * as path from 'path'

// TODO: clear up this messed up tangled share/diffs code
import { authStore, shareStore } from '@/config/config'
import diffs from '@/services/diffs'
import share from '@/services/share'
import logger from '@/logger'
import api, { API_SHARE_CREATE_FILEID } from '@/services/api'

async function downloadPPT(data) {
  if (data.sliceIndex === 0) share.createWorkspace()
  const fpath = await share.downloadPPT(data)
  this.emit('res:share:downloadPPT', { fpath })
}

async function createFileId(fpath) {
  // TODO: IMPORTANT! find a way to re-authenticate when restarting the server
  const fileId = await api.post(API_SHARE_CREATE_FILEID, { fpath }, 'share:createFileId', this)
  logger.log('FILE ID', fileId)
  return { fileId }
}

type TConfig = {
  origin: string
  groups: Array<any>
}

/**
 * @param config Object data = { origin, groups }
 */
function startSharing(config: TConfig) {
  share.startSharing(config)
    .then(data => this.emit('res:share:start', { data }))
    .catch(err => {
      console.error(err)
      logger.error('startSharing op failure', err)
      this.emit('error:share:start', err)
    })
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
}

async function acceptShare(origin: string) {
  const peerFile = await share.acceptShare(origin)
  const peerFile64 = await share.fileToBase64(peerFile)
  // TODO: this is potentially sending large files (e.g. 200+MB) to the server and then back
  this.emit('res:share:acceptShare', { peerFile, peerFile64 })
}

type TSetupInfo = {
  fpath: string
  origin: string
  wsFolder: string
}

/**
 * @param data { fpath, origin, wsFolder }
 */
async function setupReceived(data: TSetupInfo) {
  // data = { fpath, origin, wsFolder }
  const { fpath, wsFolder } = await share.setupReceived(data)
  this.emit('res:share:setupReceived', { fpath, wsFolder })
}

async function getFileOrigin(fpath: string) {
  const filename = path.basename(fpath)
  if (!filename) {
    this.emit('error:share:getFileOrigin', { op: 'getFileOrigin', err: 'empty filename' })
  }
  share
    .getFileOrigin(filename)
    .then(res => {
      console.log('GOT FILE ORIGIN', res.data)
      this.emit('res:share:getFileOrigin', res.data)
    })
    .catch(err => {
      console.log('Error getting file origin', err)
      this.emit('error:share.getFileOrigin', err)
    })
}

async function getOriginInfo(origin: string) {
  if (!origin) return this.emit('error:share:getOriginInfo', { op: 'getOriginInfo', err: 'empty origin' })
  share
    .getOriginInfo(origin)
    .then(res => {
      logger.info('origin info', res.data)
      this.emit('res:share:setFileOrigin', res.data)
    })
}

async function getDiffs({ origin, contrib, fpath, cid }) {
  const { extractDir } = await diffs.diffWithContributor({ contrib, origin, fpath, cid })
  const pptFilename = `${contrib._id}.pptx`
  const peerFile = await share.buildPPTX({ extractDir, pptFilename })
  const peerFile64 = await share.fileToBase64(peerFile)
  this.emit('res:share:peerFile', peerFile64)
}

async function willOpenPPT({ user, origin, fpath }) {
  await shareStore.set('uid', user?._id)
  await shareStore.set('origin', origin)
  await shareStore.set('fpath', fpath)
  await shareStore.set('configDate', new Date())
  logger.log('WILL OPEN PPT', origin)
  this.emit('res:share:willOpenPPT')
}

async function checkReceived() {
  const origin     = await shareStore.get('origin')
  const fpath      = await shareStore.get('fpath')
  const configDate = new Date(await shareStore.get('configDate'))

  const user   = await authStore.get('user')
  const tokens = await authStore.get('tokens')

  /* @ts-ignore */
  const timediff = new Date() - configDate
  logger.log('checkReceived', origin, configDate, timediff)

  if (timediff < 60000) {
    this.emit('res:share:checkReceived', { origin, fpath, user, tokens })
  }

  this.emit('res:share:checkReceived', '')
}

async function updateFilename(data) {
  // data = { origin, fpath, wsFolder }
  share.unmonitorOrigin(data.origin)
  share.monitorFile(data)
  this.emit('res:share:updateFilename')
}

async function pptContributors({ origin, fpath }) {
  const contributors = await diffs.refreshAdhocChanges({ origin, fpath })
  this.emit('res:share:pptContributors', contributors)
}

const ShareController = {
  acceptShare,
  checkReceived,
  createFileId,
  downloadPPT,
  getDiffs,
  getFileOrigin,
  getOriginInfo,
  pptContributors,
  setupReceived,
  startSharing,
  updateFilename,
  willOpenPPT,
}

export default ShareController
