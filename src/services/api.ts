import axios from 'axios'
import FormData from 'form-data'
import fs from 'node:fs'

import Config from '@/config/config'
import git from './git'
import logger from '@/logger'

import { CΩStore } from './store'

export type TCredentials = {
  strategy: string
  email: string
  password: string
}

CΩStore.swarmAuthStatus = 0

let lastAuthorization = []

type SHARE_URL_TYPE = {
  url: string,
}

export const API_AUTH_LOGIN          = '/auth/login'
export const API_AUTH_SIGNUP         = '/auth/register'
export const API_AUTH_REFRESH_TOKENS = '/auth/refresh-tokens'
export const API_LOG                 = '/logger'
export const API_REPO_GET_INFO       = '/repos/info'
export const API_REPO_SWARM_AUTH     = '/repos/swarm-auth'
export const API_REPO_COMMITS        = '/repos/commits'
export const API_REPO_COMMON_SHA     = '/repos/common-sha'
export const API_REPO_CONTRIB        = '/repos/contrib'
export const API_REPO_DIFF_FILE      = '/repos/diffs'

export const API_SHARE_ACCEPT        = '/share/accept'
export const API_SHARE_FINFO         = '/share/getFileOrigin'
export const API_SHARE_CREATE_FILEID = '/share/new'
export const API_SHARE_DOWNLOAD      = '/share/download'
export const API_SHARE_OINFO         = '/share/getOriginInfo'
export const API_SHARE_SLIDE_CONTRIB = '/share/slideContrib'
export const API_SHARE_START         = '/share/start'
export const API_SHARE_UPLOAD        = '/share/upload'

axios.defaults.adapter = require('axios/lib/adapters/http')
export const axiosAPI = axios.create({ baseURL: Config.API_URL })

axiosAPI.interceptors.request.use(config => {
  const { access } = CΩStore.tokens || { access: {} }
  if (access.token) config.headers.authorization = `Bearer ${access.token}`
  return config
})

axiosAPI.interceptors.response.use(
  (response: any) => {
    if (response.status === 202) { // We are processing the requests as authorized for now, but we need to send the required (or latest) SHA to continue being authorized
      // we do this strange response.statusText OR response.data.statusText because of a glitch in the test, it seems I can't make it work with supertest
      // if (!response.statusText && !response.data.statusText) return response
      console.log(response.data, response.statusText, response.status)
      const cΩ = response.data.cΩ
      const text = response.statusText || response.data.statusText
      const authPromise = reAuthorize({ text, cΩ }) // IMPORTANT: no await! otherwise we interrupt the regular operations for too long, and we also get deeper into a recursive interceptor response.
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
      }
      return reject(err)
    })
  },
)

function clearAuth() {
  lastAuthorization = []
}

type TReauthReq = {
  text: string
  cΩ: string
}

/**
 * fetch the branch requested and send the requested SHA corresponding to the `commitDate`.
 *
 * @param { repo, cΩ } where repo contains `origin`, `branch` and `commitDate` and the cΩ is the socket ID
 *
 * @return object the matching repository. This may be the repo shared with everyone, or a siloed repo if the auth failed.
 */
function reAuthorize({ text, cΩ }: TReauthReq) {
  console.log('RE AUTH', text)
  const { origin, branch, commitDate } = JSON.parse(text)
  if (Object.keys(lastAuthorization).length && (new Date()).valueOf() - lastAuthorization[origin] < 120) return // TODO: optimize / configure; for now we'll only allow reauth once every 2 min
  lastAuthorization[origin] = (new Date()).valueOf()
  const project = CΩStore.projects.filter(p => p.origin === origin)[0]
  if (!project) return
  const wsFolder = project.root
  if (!commitDate) return sendLatestSHA({ wsFolder, origin, cΩ })
  return git.command(wsFolder, 'git fetch')
    .then(() => {
      const cd = new Date(commitDate)
      // TODO: thoroughly test this one with time-zones (vscode official repo is ideal for this)
      const options = `--since=${cd.toISOString()} --until=${cd.toISOString()}`
      return git.command(wsFolder, `git log --pretty="%cd %H" ${options} --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, d, h] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
    .then(res => {
      return res.data?.repo
    })
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin, cΩ }: any): Promise<any> {
  let branch: string
  return git.command(wsFolder, 'git branch -a --sort=committerdate')
    .then(out => {
      branch = out.split('\n')[0].replace('remotes/origin/', '').replace(/ /g, '')
      console.log('SEND LATEST SHA', branch, out)
      return git.command(wsFolder, `git fetch origin ${branch}:${branch}`)
    })
    .then(() => {
      return git.command(wsFolder, 'git for-each-ref --sort="-committerdate" --count=1 refs/remotes')
    })
    .then(out => {
      const line = /(\t|\s)([^\s]+)$/.exec(out.trim())
      branch = line[2].replace('refs/remotes/', '')
      return git.command(wsFolder, `git log --pretty="%cd %H" -n1 --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(logger.error)
}

function login({ email, password, socket }) {
  return CΩAPI.post(API_AUTH_LOGIN, { email, password }, 'auth:login', socket)
}

function logout() {
  // TODO: logout from API
}

function signup({ email, password, socket }) {
  CΩAPI.post(API_AUTH_SIGNUP, { email, password }, 'auth:signup', socket)
}

function refreshToken(refreshToken: string) {
  return axiosAPI
    .post(API_AUTH_REFRESH_TOKENS, { refreshToken })
    .then((res: any) => CΩStore.setAuth(res.data))
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

const submitAuthBranch = ({ origin, sha, branch, commitDate }: any): Promise<any> => axiosAPI.post(API_REPO_SWARM_AUTH, { origin, sha, branch, commitDate })

/**
 * Setup the share based on either <fileId, userId> or <origin, userId> when fileId is not available.
 *
 * @params { origin, groups }
 *
 * @return [ url ] links
 */
const setupShare = (data: any): Promise<any> => {
  const { origin, groups } = data
  logger.log('SHARE FILE', data)
  const zipForm = new FormData()
  zipForm.append('origin', origin)
  zipForm.append('groups', JSON.stringify(groups))
  logger.log('Now reading file', origin)
  zipForm.append('file', fs.createReadStream(origin), { filename: origin }) // !! the file has to be last appended to formdata
  logger.log('UPLOADING FILE', origin)
  return axiosAPI
    .post(API_SHARE_UPLOAD, zipForm,
      {
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
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

function post(url, data, action?: string, socket?: any) {
  logger.log('POST to CodeAwareness', url)
  const promise = CΩAPI.axiosAPI.post(url, data)

  if (!socket) {
    logger.log('no socket when posting to API')
    return promise
  }

  return promise
    .then(res => {
      console.log('POST result', action, res.data)
      if (action) socket.emit(`res:${action}`, res.data)
      return res.data
    })
    .catch(err => {
      logger.error(`API call failed for ${action}`)
      if (action) socket.emit(`error:${action}`, err?.response?.data)
      throw err
    })
}

const CΩAPI = {
  // common
  axiosAPI,
  getOriginInfo,
  login,
  logout,
  post,
  refreshToken,
  signup,

  // code repo
  clearAuth,
  downloadDiffFile,
  getRepo,
  sendLatestSHA,
  submitAuthBranch,

  // powerpoint
  acceptShare,
  getFileOrigin,
  getPPTSlideContrib,
  setupShare,

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
