/* @flow */

const axios = require('axios')
const FormData = require('form-data')
const { createReadStream } = require('fs')

const { API_URL } = require('@/config/config')
const git = require('@/services/git')

const { Peer8Store } = require('./peer8.store')

const API_AUTH_LOGIN          = '/auth/login'
const API_AUTH_REFRESH_TOKENS = '/auth/refresh-tokens'
const API_REPO_GET_INFO       = '/repos/info'
const API_REPO_SWARM_AUTH     = '/repos/swarm-auth'
const API_REPO_COMMITS        = '/repos/commits'
const API_REPO_COMMON_SHA     = '/repos/common-sha'
const API_REPO_CONTRIB        = '/repos/contrib'
const API_REPO_DIFF_FILE      = '/repos/diff'
const API_SHARE_START         = '/share/start'
const API_SHARE_ACCEPT        = '/share/accept'

axios.defaults.adapter = require('axios/lib/adapters/http')
const axiosAPI = axios.create({ baseURL: API_URL })

axiosAPI.interceptors.request.use(config => {
  const { access } = Peer8Store.tokens || { access: {} }
  if (access.token) config.headers.authorization = `Bearer ${access.token}`
  return config
})

axiosAPI.interceptors.response.use(
  response => {
    if (response.status === 202) { // We are processing the requests as authorized for now, but we need to send the required (or latest) SHA to continue being authorized
      const authPromise = reAuthorize(response.statusText || response.data.statusText) // IMPORTANT: no await! otherwise we interrupt the regular operations for too long, and we also get deeper into a recursive interceptor response.
      // also, we do this strange response.statusText OR response.data.statusText because of a glitch in the test, it seems I can't make it work with supertest
      if (Peer8Store.swarmAuthStatus) {
        // TODO: try to disconnect multiple swarmAuth promises (for multiple repos at a time), so one repo doesn't have to wait for all repos to complete swarm authorization.
        Peer8Store.swarmAuthStatus.then(() => authPromise)
      } else {
        Peer8Store.swarmAuthStatus = authPromise
      }
    }
    return response
  },
  err => {
    if (!err.response) return Promise.reject(err)
    return new Promise((resolve, reject) => {
      if (err.response.status === 401 && err.config && err.response.config.url !== API_AUTH_REFRESH_TOKENS) {
        if (!Peer8Store.tokens) return Peer8API.logout(reject, 'No tokens in the store.', err)
        const { refresh } = Peer8Store.tokens
        if (!refresh || refresh.expires < new Date().valueOf()) return Peer8API.logout(reject, 'Refresh token expired ' + refresh.expires, err)
        return Peer8API.refreshToken(refresh.token)
          .then(() => {
            const { token } = Peer8Store.tokens.access
            err.config.headers.authorization = `Bearer: ${token}`
            axiosAPI(err.config).then(resolve, reject)
          })
          .catch(err => {
            return Peer8API.logout(reject, 'You have been logged out', err)
          })
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
  if (lastAuthorization.length && new Date() - lastAuthorization[origin] < 60000) return // TODO: optimize / configure
  lastAuthorization[origin] = new Date()
  const project = Peer8Store.projects.filter(p => p.origin === origin)[0]
  if (!project) return
  const wsFolder = project.root
  if (!commitDate) return sendLatestSHA({ wsFolder, origin })
  return git.gitCommand(wsFolder, 'git fetch')
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
      return git.gitCommand(wsFolder, `git log --pretty="%cd %H" ${options} --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line no-unused-vars
      const [a, d, h] = /(.+) (.+)/.exec(log)
      return submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin }: any): Promise<any> {
  let branch
  return git.gitCommand(wsFolder, 'git fetch')
    .then(() => {
      return git.gitCommand(wsFolder, 'git for-each-ref --sort="-committerdate" --count=1 refs/remotes')
    })
    .then(out => {
      const line = /(\t|\s)([^\s]+)$/.exec(out.trim())
      branch = line[2].replace('refs/remotes/', '')
      return git.gitCommand(wsFolder, `git log --pretty="%cd %H" -n1 --date=iso-strict ${branch}`)
    })
    .then(log => {
      // eslint-disable-next-line no-unused-vars
      const [a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(console.error)
}

function logout(reject: function, msg: string, err: Object) {
  Peer8Store.user = ''
  Peer8Store.tokens = ''

  reject(err)
}

function refreshToken(refreshToken: string) {
  return axiosAPI
    .post(API_AUTH_REFRESH_TOKENS, { refreshToken })
    .then(res => (Peer8Store.tokens = res.data.tokens))
}

function downloadDiffs({ origin, fpath }: any): Promise<any> {
  return axiosAPI(`${API_REPO_CONTRIB}?origin=${origin}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
}

function downloadDiffFile({ origin, fpath }) {
  return axiosAPI(`${API_REPO_DIFF_FILE}?origin=${origin}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
}

function getRepo(origin) {
  return axiosAPI(`${API_REPO_GET_INFO}?origin=${origin}`, { method: 'GET', responseType: 'json' })
}

/**
 * data: { origin, list }
 */
function sendCommitLog(data) {
  return axiosAPI.post(API_REPO_COMMITS, data)
}

function findCommonSHA({ origin }) {
  return axiosAPI(`${API_REPO_COMMON_SHA}?origin=${origin}`, { method: 'GET', responseType: 'json' })
}

const sendDiffs = ({ zipFile, origin, cSHA, activePath }) => {
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
    .catch(err => console.error(err.response.status, err.response.statusText)) // TODO: error handling
}

const login = ({ email, password }: any): Promise<any> => axiosAPI.post(API_AUTH_LOGIN, { email, password })

const submitAuthBranch = ({ origin, sha, branch, commitDate }: any): Promise<any> => axiosAPI.post(API_REPO_SWARM_AUTH, { origin, sha, branch, commitDate })

const shareFile = ({ zipFile, groups }: any): Promise<any> => {
  const zipForm = new FormData()
  zipForm.append('groups', JSON.stringify(groups))
  zipForm.append('zipFile', createReadStream(zipFile), { filename: zipFile }) // !! the file HAS to be last appended to FormData
  return axiosAPI
    .post(API_SHARE_START, zipForm,
      {
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    .then(res => res.data)
    .catch(err => console.error(err.response.status, err.response.statusText)) // TODO: error handling
}

const receiveShared = link => {
  const uri = encodeURIComponent(link)
  return axiosAPI(`${API_SHARE_ACCEPT}?origin=${uri}`, { method: 'GET', responseType: 'application/zip' })
}

const Peer8API = {
  clearAuth,
  downloadDiffFile,
  downloadDiffs,
  findCommonSHA,
  getRepo,
  login,
  logout,
  receiveShared,
  refreshToken,
  sendCommitLog,
  sendDiffs,
  sendLatestSHA,
  shareFile,
  submitAuthBranch,
  API_AUTH_LOGIN,
  API_REPO_COMMITS,
  API_REPO_COMMON_SHA,
  API_REPO_CONTRIB,
  API_AUTH_REFRESH_TOKENS,
  API_REPO_SWARM_AUTH,
  API_URL,
}

module.exports = Peer8API
