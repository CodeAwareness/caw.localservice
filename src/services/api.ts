import axios from 'axios'

import CAWDiffs from '@/services/diffs'
import Config from '@/config/config'
import git from './git'
import logger from '@/logger'

import CAWStore from './store'

export type TCredentials = {
  strategy: string
  email: string
  password: string
}

CAWStore.swarmAuthStatus = 0

let lastAuthorization = []

export const API_AUTH_LOGIN          = '/auth/login'
export const API_AUTH_SIGNUP         = '/auth/register'
export const API_AUTH_REFRESH_TOKENS = '/auth/refresh-tokens'
export const API_LOG                 = '/logger'
export const API_REPO_GET_INFO       = '/repos/info'
export const API_REPO_SWARM_AUTH     = '/repos/swarm-auth'
export const API_REPO_COMMITS        = '/repos/commits'
export const API_REPO_COMMON_SHA     = '/repos/common-sha'
export const API_REPO_PEERS          = '/repos/peers'
export const API_REPO_AGGREGATE      = '/repos/aggregate'
export const API_REPO_CHANGES        = '/repos/changes'
export const API_REPO_DIFF_FILE      = '/repos/diffs'

export const API_SHARE_ACCEPT   = '/share/accept'
export const API_SHARE_FINFO    = '/share/file-info'
export const API_SHARE_OINFO    = '/share/origin-info'
export const API_SHARE_UPLOAD   = '/share/upload'
export const API_SHARE_FILEID   = '/share/file-id'
export const API_SHARE_DOWNLOAD = '/share/download'
export const API_SHARE_CONTRIB  = '/share/contrib'
export const API_SHARE_START    = '/share/start'

// axios.defaults.adapter = require('axios/lib/adapters/http')
export const axiosAPI = axios.create({ baseURL: Config.API_URL })

axiosAPI.interceptors.request.use(config => {
  const { access } = CAWStore.tokens || { access: {} }
  if (access.token) config.headers.authorization = `Bearer ${access.token}`
  return config
})

axiosAPI.interceptors.response.use(
  (response: any) => {
    if (response.status === 202) { // We are processing the requests as authorized for now, but we need to send the required (or latest) SHA to continue being authorized
      // we do this strange response.statusText OR response.data.statusText because of a glitch in the test, it seems I can't make it work with supertest
      // if (!response.statusText && !response.data.statusText) return response
      const { cmd, origin, branch, commitDate, clientId } = getLinks(response)
      if (cmd === 'latestSHA') {
        // get latest SHA: for now we check this inside reAuthorize, by differentiating logic based on the existence of commitDate
      } else if (cmd === 'swarmAuth') {
        // swarmAuth: for now we check this inside reAuthorize, by differentiating logic based on the existence of commitDate
      }
      logger.log('SWARM AUTH COMMAND', cmd)
      const authPromise = reAuthorize(origin, branch, commitDate, clientId) // IMPORTANT: no await! otherwise we interrupt the regular operations for too long, and we also get deeper into a recursive interceptor response.
        .then(res => {
          if (res.data?.repo._REQUEST_DIFF) {
            CAWDiffs.sendDiffs(CAWStore.activeProjects[clientId], clientId)
          }
        })
      // Save the authPromise in the store, so we can use it for subsequent requests, and avoid triggering reAuthorize for each one of them
      if (CAWStore.swarmAuthStatus) {
        // TODO: try to disconnect multiple swarmAuth promises (for multiple repos at a time), so one repo doesn't have to wait for all repos to complete swarm authorization.
        CAWStore.swarmAuthStatus.then(() => authPromise)
      } else {
        CAWStore.swarmAuthStatus = authPromise
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
        if (!CAWStore.tokens) {
          // TODO: logout()
          return reject(new Error('No tokens in store'))
        }
        const { refresh } = CAWStore.tokens
        if (!refresh || refresh.expires < new Date().valueOf()) {
          // TODO: logout()
          return reject(new Error(`Refresh token expired ${refresh.expires}`))
        }
        logger.log('Will try again after refreshing the tokens')
        refreshToken(refresh.token)
          .then(() => {
            const { token } = CAWStore.tokens.access
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

function getLinks(res) {
  return res.headers.link?.split(',').reduce((ret, s) => {
    const p = s.split(';')
    const key = p[1].slice(6, -1)
    const val = p[0].split('<')[1].slice(0, -1)
    ret[key] = val
    return ret
  }, {})
}

function clearAuth() {
  lastAuthorization = []
}

/**
 * fetch the branch requested and send the requested SHA corresponding to the `commitDate`.
 *
 * @param { repo, caw } where repo contains `origin`, `branch` and `commitDate` and the caw is the socket ID
 *
 * @return object the matching repository. This may be the repo shared with everyone, or a siloed repo if the auth failed.
 */
function reAuthorize(origin, branch, commitDate, caw) {
  if (Object.keys(lastAuthorization).length && (new Date()).valueOf() - lastAuthorization[origin] < 120) return // TODO: optimize / configure; for now we'll only allow reauth once every 2 min
  lastAuthorization[origin] = (new Date()).valueOf()
  const project = CAWStore.projects.filter(p => p.origin === origin)[0]
  if (!project) return
  const wsFolder = project.root
  if (!commitDate) return sendLatestSHA({ wsFolder, origin, caw })
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
      return submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
    .then(res => {
      return res.data?.repo
    })
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin }: any): Promise<any> {
  let branch: string
  return git.command(wsFolder, 'git branch -a --sort=committerdate')
    .then(out => {
      branch = out.split('\n')[0].replace('remotes/origin/', '').replace(/[\s*]/g, '')
      return git.command(wsFolder, `git fetch -u origin ${branch}:${branch}`)
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
      return submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(logger.error)
}

function refreshToken(refreshToken: string) {
  return axiosAPI
    .post(API_AUTH_REFRESH_TOKENS, { refreshToken })
    .then((res: any) => CAWStore.setAuth(res.data))
}

const submitAuthBranch = ({ origin, sha, branch, commitDate }: any): Promise<any> => axiosAPI.post(API_REPO_SWARM_AUTH, { origin, sha, branch, commitDate })

function post(url, data, action?: string, socket?: any) {
  const promise = axiosAPI.post(url, data)

  if (!socket) {
    logger.log('no socket when posting to API')
    return promise
  }

  return promise
    .then(res => {
      if (action) socket.emit(`res:${action}`, res.data)
      return res.data
    })
    .catch(err => {
      logger.error(`API call failed for ${action}`, err)
      if (action) socket.emit(`error:${action}`, err?.response?.data || { message: err?.code })
      throw err
    })
}

const CAWAPI = {
  // common
  axiosAPI,
  post,
  reAuthorize,
  refreshToken,

  // code repo
  clearAuth,
  sendLatestSHA,
  submitAuthBranch,

  // repo API routes
  API_AUTH_LOGIN,
  API_AUTH_SIGNUP,
  API_AUTH_REFRESH_TOKENS,
  API_LOG,
  API_REPO_AGGREGATE,
  API_REPO_CHANGES,
  API_REPO_GET_INFO,
  API_REPO_SWARM_AUTH,
  API_REPO_COMMITS,
  API_REPO_COMMON_SHA,
  API_REPO_PEERS,
  API_REPO_DIFF_FILE,

  // share API routes
  API_SHARE_ACCEPT,
  API_SHARE_FINFO,
  API_SHARE_OINFO,
  API_SHARE_UPLOAD,
  API_SHARE_FILEID,
  API_SHARE_DOWNLOAD,
  API_SHARE_CONTRIB,
  API_SHARE_START,
}

export default CAWAPI
