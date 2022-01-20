import type { CΩRequest, CΩResponse } from '@/app'

import { CΩStore } from '@/services/cA.store'
import CΩAPI from '@/services/api'
import git from '@/services/git'
import config from '@/config/config'
import wsGardener from '@/middlewares/wsio.gardener'

let lastAuthorization: Record<string, number> = {}

const logout = () => {
  config.authStore.clear()
  CΩStore.tokens = undefined
  CΩStore.user = undefined
  lastAuthorization = {}
}

const info = () => {
  const { user, tokens } = CΩStore
  wsGardener.transmit('info:load', { user, tokens })
}

/* cA syncing between PPT web and cA local service */
const sync = code => {
  console.log('AUTH:SYNC controller')
  if (!code) wsGardener.transmit('error:auth:sync', 'sync code invalid')
  return CΩAPI
    .sync(code)
    .then(() => {
      wsGardener.transmit('res:auth:sync')
    })
    .catch(_ => wsGardener.transmit('error:auth:sync', 'could not sync with the code provided.'))
}

const AUTH_COMPLETE_HTML = '<html><body><h4>Code Awareness local service:</h4><h1>Authentication complete.</h1><p>You may now close this window.</p></body><style>body { text-align: center; padding-top: 4em; }</style></html>'
const AUTH_ERROR_HTML = (err: string) => `<html><body><h4>Code Awareness local service:</h4><h1 style="padding-top: 4em; color: #a00">Error trying to authenticate.</h1>${err}</body><style>body { text-align: center; padding-top: 4em; }</style></html>`

/* cA Portal will use this for immediate authentication (when not using Safari) */
const httpSync = (req: CΩRequest, res: CΩResponse) => {
  console.log('AUTH:HTTPSYNC controller')
  CΩAPI
    .sync(req.query.code)
    .then(() => {
      wsGardener.transmit('auth:sync:complete')
      res.send(AUTH_COMPLETE_HTML)
    })
    .catch(err => res.send(AUTH_ERROR_HTML(err)))
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
      // eslint-disable-next-line no-unused-vars
      const [a, d, h] = /(.+) (.+)/.exec(log)
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
      // eslint-disable-next-line no-unused-vars
      const [a, commitDate, sha] = /(.+) (.+)/.exec(log)
      return CΩAPI.submitAuthBranch({ origin, sha, commitDate, branch })
    })
    .catch(console.error)
}

function passwordAssist({ email }) {
  // return CΩAPI.post(`${SERVER_URL}/auth/forgot-password`, { email })
}

const authController = {
  logout,
  httpSync,
  info,
  passwordAssist,
  reAuthorize,
  sendLatestSHA,
  sync,
}

export default authController
