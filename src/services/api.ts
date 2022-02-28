import axios from 'axios'
import FormData from 'form-data'
import { createReadStream } from 'fs'

import Config from '@/config/config'
import git from './git'
import logger from '@/logger'

import { CΩStore } from './cA.store'

export type TCredentials = {
  strategy: string
  email: string
  password: string
}

CΩStore.swarmAuthStatus = 0

type SHARE_URL_TYPE = {
  url: string,
}

export const API_AUTH_LOGIN          = '/auth/login'
export const API_AUTH_SIGNUP         = '/auth/register'
export const API_AUTH_REFRESH_TOKENS = '/auth/refresh-tokens'
export const API_LOG                 = '/log'
export const API_REPO_GET_INFO       = '/repos/info'
export const API_REPO_SWARM_AUTH     = '/repos/swarm-auth'
export const API_REPO_COMMITS        = '/repos/commits'
export const API_REPO_COMMON_SHA     = '/repos/common-sha'
export const API_REPO_CONTRIB        = '/repos/contrib'
export const API_REPO_DIFF_FILE      = '/repos/diff'
export const API_SHARE_SLIDE_CONTRIB = '/share/slideContrib'
export const API_SHARE_START         = '/share/start'
export const API_SHARE_UPLOAD        = '/share/uploadOriginal'
export const API_SHARE_ACCEPT        = '/share/accept'
export const API_SHARE_FINFO         = '/share/getFileOrigin'
export const API_SHARE_OINFO         = '/share/getOriginInfo'

axios.defaults.adapter = require('axios/lib/adapters/http')
const axiosAPI = axios.create({ baseURL: Config.API_URL })

axiosAPI.interceptors.request.use(config => {
  const { access } = CΩStore.tokens || { access: {} }
  if (access.token) config.headers.authorization = `Bearer ${access.token}`
  return config
})

axiosAPI.interceptors.response.use(
  (response: any) => {
    if (response.status === 202) { // We are processing the requests as authorized for now, but we need to send the required (or latest) SHA to continue being authorized
      const authPromise = reAuthorize(response.statusText || response.data.statusText) // IMPORTANT: no await! otherwise we interrupt the regular operations for too long, and we also get deeper into a recursive interceptor response.
      // also, we do this strange response.statusText OR response.data.statusText because of a glitch in the test, it seems I can't make it work with supertest
      if (CΩStore.swarmAuthStatus) {
        // TODO: try to disconnect multiple swarmAuth promises (for multiple repos at a time), so one repo doesn't have to wait for all repos to complete swarm authorization.
        CΩStore.swarmAuthStatus.then(() => authPromise)
      } else {
        CΩStore.swarmAuthStatus = authPromise
      }
    }
    return response
  },
  err => {
    if (!err.response) return Promise.reject(err)
    return new Promise((resolve, reject) => {
      if (
        err.response.status === 401
        && err.config
        && ![API_AUTH_REFRESH_TOKENS, API_AUTH_LOGIN].includes(err.response.config.url)
      ) {
        if (!CΩStore.tokens) {
          CΩAPI.logout()
          return reject(new Error('No tokens in store'))
        }
        const { refresh } = CΩStore.tokens
        if (!refresh || refresh.expires < new Date().valueOf()) {
          CΩAPI.logout()
          return reject(new Error(`Refresh token expired ${refresh.expires}`))
        }
        logger.log('Will try again after refreshing the tokens')
        CΩAPI.refreshToken(refresh.token)
          .then(() => {
            const { token } = CΩStore.tokens.access
            err.config.headers.authorization = `Bearer: ${token}`
            logger.log('Token refreshed', token)
            axiosAPI(err.config).then(resolve, reject)
          })
          .catch(reject)
          /*
          .catch(err => {
            return CΩAPI.logout(reject, 'You have been logged out', err.response)
          })
          */
      }
      return reject(err)
    })
  },
)

let lastAuthorization = []

function clearAuth() {
  lastAuthorization = []
}

/**
 * reAuthorize: fetch and send the latest SHA
 */
function reAuthorize(text) {
  const { origin, branch, commitDate } = JSON.parse(text)
  /* @ts-ignore */
  if (lastAuthorization.length && new Date() - lastAuthorization[origin] < 60000) return // TODO: optimize / configure
  lastAuthorization[origin] = new Date()
  const project = CΩStore.projects.filter(p => p.origin === origin)[0]
  if (!project) return
  const wsFolder = project.root
  if (!commitDate) return sendLatestSHA({ wsFolder, origin })
  return git.command(wsFolder, 'git fetch')
    .then(() => {
      const cd = new Date(commitDate)
      // TODO: thoroughly test this one with time-zones (vscode official repo is ideal for this)
      /*
      cd.setMinute(cd.getMinute() - 5)
      const start = cd.toISOString()
      cd.setMinute(cd.getMinute() + 11)
      const end = cd.toISOString()
      const options = start ? `--since=${start} --until=${end}` : '-n5'
      */
      const options = `--since=${cd.toISOString()} --until=${cd.toISOString()}`
      return git.command(wsFolder, `git log --pretty="%cd %H" ${options} --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line
      const [a, d, h] = /(.+) (.+)/.exec(log)
      return submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin }: any): Promise<any> {
  let branch
  return git.command(wsFolder, 'git fetch')
    .then(() => {
      return git.command(wsFolder, 'git for-each-ref --sort="-committerdate" --count=1 refs/remotes')
    })
    .then(out => {
      const line = /(\t|\s)([^\s]+)$/.exec(out.trim())
      branch = line[2].replace('refs/remotes/', '')
      return git.command(wsFolder, `git log --pretty="%cd %H" -n1 --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line
      const [a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(logger.error)
}

function logout() {
  CΩStore.user = ''
  CΩStore.tokens = ''
}

function refreshToken(refreshToken: string) {
  return axiosAPI
    .post(API_AUTH_REFRESH_TOKENS, { refreshToken })
    .then((res: any) => {
      CΩStore.user = res.data.user
      CΩStore.tokens = res.data.tokens
    })
}

function downloadDiffs({ origin, fpath }: any): Promise<any> {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_REPO_CONTRIB}?origin=${uri}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
}

function downloadDiffFile({ origin, fpath }: any): Promise<any> {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_REPO_DIFF_FILE}?origin=${uri}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
}

function getRepo(origin: string): Promise<any> {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_REPO_GET_INFO}?origin=${uri}`, { method: 'GET', responseType: 'json' })
}

function getPPTSlideContrib({ origin, fpath }) {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_SHARE_SLIDE_CONTRIB}?origin=${uri}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
}

/**
 * data: { origin, list }
 */
function sendCommitLog(data: any): Promise<any> {
  return axiosAPI.post(API_REPO_COMMITS, data)
}

function findCommonSHA(origin: string): Promise<any> {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_REPO_COMMON_SHA}?origin=${uri}`, { method: 'GET', responseType: 'json' })
}

const sendDiffs = ({ zipFile, origin, cSHA, activePath }: any): Promise<any> => {
  const zipForm = new FormData()
  zipForm.append('activePath', activePath)
  zipForm.append('origin', origin)
  zipForm.append('sha', cSHA)
  zipForm.append('zipFile', createReadStream(zipFile), { filename: zipFile }) // !! the file HAS to be last appended to FormData
  return axiosAPI
    .post(API_REPO_CONTRIB, zipForm,
      {
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    .then(res => res.data)
    .catch(err => logger.error('API error', err.status, err.code, err.request._currentUrl, err.request._currentRequest?.method)) // TODO: error handling
}

const submitAuthBranch = ({ origin, sha, branch, commitDate }: any): Promise<any> => axiosAPI.post(API_REPO_SWARM_AUTH, { origin, sha, branch, commitDate })

const shareFile = ({ origin, zipFile }: any): Promise<any> => {
  const zipForm = new FormData()
  zipForm.append('origin', origin)
  zipForm.append('zipFile', createReadStream(zipFile), { filename: zipFile }) // !! the file has to be last appended to formdata
  return axiosAPI
    .post(API_SHARE_UPLOAD, zipForm,
      {
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    .then(res => res.data)
    .catch(err => logger.error('API error', err.status, err.code, err.request._currentUrl, err.request._currentRequest?.method)) // todo: error handling
}

const setupShare = (groups: Array<string>): Promise<any> => {
  return axiosAPI
    .post(API_SHARE_START, { groups })
    .then(res => res.data)
}

const acceptShare = link => {
  const uri = encodeURIComponent(link)
  return axiosAPI.get<SHARE_URL_TYPE>(`${API_SHARE_ACCEPT}?origin=${uri}`)
}

const getFileOrigin = fpath => {
  const uri = encodeURIComponent(fpath)
  logger.log(`will request ${API_SHARE_FINFO} for fpath ${uri}`)
  return axiosAPI(`${API_SHARE_FINFO}?fpath=${uri}`, { method: 'GET', responseType: 'json' })
}

const getOriginInfo = origin => {
  const uri = encodeURIComponent(origin)
  return axiosAPI(`${API_SHARE_OINFO}?origin=${uri}`, { method: 'GET', responseType: 'json' })
}

function post(url, data, action, socket) {
  return CΩAPI.axiosAPI
    .post(url, data)
    .then(res => {
      socket.emit(`res:${action}`, res.data)
      return res.data
    })
    .catch(err => {
      socket.emit(`error:${action}`, err?.response?.data)
      throw new Error(err?.response?.data)
    })
}

const CΩAPI = {
  // common
  axiosAPI,
  getOriginInfo,
  logout,
  post,
  refreshToken,

  // code repo
  clearAuth,
  downloadDiffFile,
  downloadDiffs,
  findCommonSHA,
  getRepo,
  sendCommitLog,
  sendDiffs,
  sendLatestSHA,
  submitAuthBranch,

  // powerpoint
  acceptShare,
  getFileOrigin,
  getPPTSlideContrib,
  setupShare,
  shareFile,

  // API routes
  API_AUTH_LOGIN,
  API_AUTH_SIGNUP,
  API_AUTH_REFRESH_TOKENS,
  API_LOG,
  API_REPO_GET_INFO,
  API_REPO_SWARM_AUTH,
  API_REPO_COMMITS,
  API_REPO_COMMON_SHA,
  API_REPO_CONTRIB,
  API_REPO_DIFF_FILE,
  API_SHARE_SLIDE_CONTRIB,
  API_SHARE_START,
  API_SHARE_UPLOAD,
  API_SHARE_ACCEPT,
  API_SHARE_FINFO,
  API_SHARE_OINFO,
}

export default CΩAPI
