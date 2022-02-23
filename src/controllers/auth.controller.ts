import type { TCredentials } from '@/services/api'

import { CΩStore } from '@/services/cA.store'
import CΩAPI, { API_AUTH_LOGIN } from '@/services/api'
import git from '@/services/git'
import config from '@/config/config'
import wsGardener from '@/middlewares/wsio.gardener'
import type { Response } from '@/middlewares/wsio.grandstation'

let lastAuthorization: Record<string, number> = {}

function login(credentials: TCredentials) {
  CΩAPI.axiosAPI
    .post(API_AUTH_LOGIN, credentials)
    .then(data => {
      console.log('login data', data)
      this.emit('res:auth:login', JSON.stringify(data))
    })
    .catch(err => {
      console.log('LOGIN ERROR: ', err.response.statusText, err.response.data)
      this.emit('error:auth:login', err.response.statusText)
    })
}

function logout() {
  config.authStore.clear()
  CΩStore.tokens = undefined
  CΩStore.user = undefined
  lastAuthorization = {}
}

function info() {
  const { user, tokens } = CΩStore
  wsGardener.transmit('info:load', { user, tokens })
}

function signup(...args: any[]) {
  console.log('SIGNUP ', args)
}

/**
 * reAuthorize: fetch and send the latest SHA
 */
function reAuthorize(text: string) {
  const { origin, branch, commitDate } = JSON.parse(text)
  if (Object.keys(lastAuthorization).length && (new Date()).valueOf() - lastAuthorization[origin] < 60000) return // TODO: optimize / configure
  lastAuthorization[origin] = (new Date()).valueOf()
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, d, h] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, branch, sha: h, commitDate: d })
    })
}

/* TODO: throttle; when starting up VSCode we may get several such requests in quick succession */
function sendLatestSHA({ wsFolder, origin }) {
  let branch: string
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
      const [_a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(console.error)
}

function passwordAssist({ email }) {
  // return CΩAPI.post(`${SERVER_URL}/auth/forgot-password`, { email })
}

const authController = {
  login,
  logout,
  info,
  passwordAssist,
  reAuthorize,
  sendLatestSHA,
  signup,
}

export default authController
