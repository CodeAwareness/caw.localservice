import mkdirp from 'mkdirp'
import path from 'path'
import tar from 'tar'
import rimraf from 'rimraf'
import _ from 'lodash'
import FormData from 'form-data'

import { createGzip } from 'zlib'
import { PowerShell } from 'node-powershell'
import childProcess from 'child_process'
import { promises as fs, createReadStream, createWriteStream, openSync, closeSync } from 'node:fs'
import { pipeline } from 'stream'
// import { AxiosResponse } from 'axios'
// import replaceStream from 'replacestream' // doesn't work (!

import Config from '@/config/config'
import logger from '@/logger'

import git from './git'
import shell from './shell'
import CAWStore from './store'
import CAWAPI, { API_REPO_COMMITS, API_REPO_COMMON_SHA, API_REPO_CONTRIB, API_REPO_DIFF_FILE, API_SHARE_SLIDE_CONTRIB } from './api'

const PENDING_DIFFS = {}
const isWindows = !!process.env.ProgramFiles

/************************************************************************************
 * Diffs active file with the same file in a local branch
 *
 * Open the VSCode standard diff window...
 ************************************************************************************/
function diffWithBranch({ branch, cid }): Promise<any> {
  let peerFile
  const project = CAWStore.activeProjects[cid]
  const tmpDir = CAWStore.uTmpDir[cid]
  const wsFolder = project.root
  CAWStore.selectedBranch = branch
  CAWStore.selectedContributor = undefined
  const userFile = project.activePath.substr(project.root.length + 1)
  return git.command(wsFolder, 'git rev-parse --show-toplevel')
    .then(folder => {
      logger.log('DIFFS: branch in ', folder)
      // TODO: git submodules: how do we branch diff on a submodule?
      const name = path.basename(wsFolder)
      const relativeDir = userFile.substring(0, userFile.length - path.basename(userFile).length)
      const localDir = path.join(tmpDir, name, Config.EXTRACT_BRANCH_DIR)
      mkdirp.sync(path.join(localDir, relativeDir))
      peerFile = path.join(tmpDir, name, Config.EXTRACT_BRANCH_DIR, userFile)
      return git.command(wsFolder, `git --work-tree=${localDir} checkout ${branch} -- ${userFile}`)
    })
    .then(() => {
      // TODO: do something with the stderr?
      const title = `${path.basename(userFile)} ↔ Peer changes`
      return { title, peerFile, userFile: path.join(wsFolder, userFile) }
    })
    .catch(logger.error)
}

/************************************************************************************
 * Create a git diff between the active file and the same file at another peer.
 *
 * - fpath is the relative path of the currently opened file (or ppt slide)
 *
 * Open the VSCode standard diff window.
 * We're processing the unified diffs from the peer,
 * and recreate their file in a temporary folder,
 * after which we can open a standard diff VSCode window.
 *
 * TODO: maybe (!) for small teams, download all diffs at once,
 * rather than one request for each contributor;
 *
 * As a guideline, CodeAwareness should focus on small teams.
 * Perhaps this can change in the future.
 *
 * TODO: this works for VSCode, maybe other editors need a different workflow.
 *
 * @param { ct: Object, fpath: string, origin: string, wsFolder: string }
 *
 * ct = contributor: {
 *   changes: {
 *    lines: [3,5,6,...],
 *    s3key: "diffs/${ct._id}/${origin}/${fpath}",
 *    sha: 'rop231...',
 *   },
 *   email: ...
 *   lang: 'en',
 *   user: ${_id},
 * }
 *
 ************************************************************************************/
function diffWithContributor({ contrib, fpath, origin, cid }): Promise<any> {
  const tmpDir = CAWStore.uTmpDir[cid]
  const project = CAWStore.activeProjects[cid]
  const wsFolder = project.root
  const relPath = shell.getRelativePath(fpath, project)
  // !!!!! CAWWorkspace.selectContributor(ct)
  const wsName = path.basename(wsFolder)
  const archiveDir = path.join(tmpDir, wsName)
  mkdirp.sync(archiveDir)
  /* downloadedFile: we save the diffs received from the server to TMP/active.diffs */
  const downloadedFile = path.join(archiveDir, '_cA.active.diffs')
  /* archiveFile: we use git archive to extract the active file from the cSHA commit */
  const archiveFile = path.join(archiveDir, `local-${contrib.changes.sha}.tar`)
  /* extractDir: we extract the active file from the archive in this folder, so we can run git apply on it */
  const extractDir = path.join(archiveDir, Config.EXTRACT_PEER_DIR, contrib._id)
  rimraf.sync(extractDir)
  mkdirp.sync(path.join(extractDir, path.dirname(fpath)))
  /* peerFile: we finally instruct VSCode to open a diff window between the active file and the extracted file, which now has applied diffs to it */
  const peerFile = path.join(extractDir, relPath)
  logger.info('DIFFS: diffWithContributor (ct, fpath, extractDir)', contrib, fpath, extractDir)

  const uri = encodeURIComponent(origin)
  return CAWAPI.axiosAPI
    .get(`${API_REPO_DIFF_FILE}?origin=${uri}&fpath=${contrib.changes.s3key}`)
    .then(saveDownloaded)
    .then(gitArchive)
    .then(untar)
    .then(applyDiffs)
    .then(vscodeOpenDiffs)
    .catch(logger.error)

  function saveDownloaded({ data }) {
    return fs.writeFile(downloadedFile, data + '\n')
  }

  function gitArchive() {
    return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${contrib.changes.sha} ${fpath}`)
  }

  function untar() {
    return tar.x({ file: archiveFile, cwd: extractDir })
  }

  function applyDiffs() {
    // return git.command(extractDir, `git apply --whitespace=nowarn ${downloadedFile}`) // TODO: would be nice if this worked
    const cmd = isWindows ? '"C:\\Program Files\\Git\\usr\\bin\\patch.exe"' : 'patch'
    return git.command(extractDir, `${cmd} -p1 < ${downloadedFile}`)
  }

  function vscodeOpenDiffs() {
    const title = `CAW#${path.basename(fpath)} ↔ Peer changes`
    logger.info('DIFFS: vscodeOpenDiffs (ct, peerFile, fpath)', contrib, peerFile, fpath)
    return { title, extractDir, peerFile, fpath: path.join(wsFolder, fpath) }
  }
}

/************************************************************************************
 * Send a list of commmit SHAs to the server.
 *
 * We're sending a number of commit SHA values (e.g. latest 100) to the server,
 * in order to compute the common ancestor SHA for everyone in a team.
 *
 * @param project object The project for which to send the commit logs
 *
 * @return string The common SHA value
 ************************************************************************************/
function sendCommitLog(project: any): Promise<string> {
  // TODO: make MAX_COMMITS something configurable by the server instead. That way we can automatically accommodate a rescale in team size.
  const MAX_COMMITS = 1000
  const wsFolder = project.root
  const { origin } = project
  let localBranches, currentBranch

  logger.info('DIFFS: sendCommitLog (wsFolder)', wsFolder)
  return git.command(wsFolder, 'git rev-list HEAD -n1') // get the latest commit sha for the current branch
    .then(sha => {
      const head = sha.trim()
      if (project.head === head) {
        // we've already sent this HEAD value, just fetch the common SHA value, in case it's changed
        return fetchCommonSHA()
      } else {
        // when there are new commits since our last sendDiffs, we resend a block of SHA values from the current branch
        project.head = head
        return sendLog()
      }
    })

  function fetchCommonSHA() {
    const uri = encodeURIComponent(origin)
    return CAWAPI.axiosAPI(
      `${API_REPO_COMMON_SHA}?origin=${uri}`, // Do we need to send client connection ID (cid) to ensure proper swarm auth?
      { method: 'GET', responseType: 'json' }
    )
      .then(res => {
        project.cSHA = res.data?.sha
        logger.info('DIFFS: getCommonSHA for (origin, cSHA, head)', project.origin, project.cSHA, project.head)
        return project.cSHA
      })
  }

  function sendLog() {
    logger.info('DIFFS: sendLog HEAD (origin, head)', project.origin, project.head)
    return git.command(wsFolder, 'git branch --verbose --no-abbrev --no-color')
      .then(extractLog)
      .then(upload)
      .then(res => {
        logger.info('DIFFS: uploadLog received a cSHA from the server (origin, sha, head)', project.origin, res.data?.cSHA, project.head)
        project.cSHA = res.data?.cSHA
        return project.cSHA
      })
  }

  function extractLog(stdout) {
    // TODO: why a git log here doesn't reveal branches / tags, but in the terminal it does?
    localBranches = stdout
      .split(/[\n\r]/)
      .map(line => {
        const matches = /\*?\s+(\([^)]+\)|[^\s]+)\s+([^\s]+)/.exec(line)
        if (!matches) return
        const label = matches[1]
        const sha = matches[2]
        if (line[0] === '*') currentBranch = label.replace(/[()]/g, '')
        return { label, sha }
      })
      .filter(b => b)
    return git.command(wsFolder, `git log -n ${MAX_COMMITS} --pretty=oneline --format="%H" --no-color`) // max 200 commits by default
  }

  type TCommonSHA = {
    cSHA: string
  }

  function upload(stdout: string) {
    const commits = stdout.split(/[\n\r]/).filter(l => l)
    const data = {
      branch: currentBranch,
      branches: localBranches,
      commits,
      origin,
    }
    return CAWAPI.axiosAPI.post<TCommonSHA>(API_REPO_COMMITS, data)
  }
}

function createEmpty(file) {
  closeSync(openSync(file, 'w'))
}

/************************************************************************************
 * Sending commit log and diffs to the CodeAwareness server.
 * We're running a git diff against the common SHA, archive this with gzip
 * and send it to the server.
 *
 * Currently we're sending the entire project diffs to the server.
 * TODO: OPTIMIZATION: add a boolean parameter that will enable sending
 * only the file that was just saved (if file save event)
 * TODO: even more optimization: send each file modified outside VSCode (file system event)
 *
 * @param Object - CAWStore project
 * @param string - the app unique ID (cid)
 ************************************************************************************/
const lastSendDiff = []
function sendDiffs(project: any, cid: string): Promise<void> {
  if (!project) return Promise.resolve()
  const wsFolder = project.root
  const tmpDir = CAWStore.uTmpDir[cid]
  const activePath = project.activePath || ''
  // TODO: better throttling mechanism, maybe an express middleware
  if (lastSendDiff[wsFolder]) {
    /* @ts-ignore */
    if (new Date() - lastSendDiff[wsFolder] < Config.SYNC_THRESHOLD) return Promise.resolve()
  } else {
    lastSendDiff[wsFolder] = new Date()
  }
  const wsName = path.basename(wsFolder)
  const diffDir = path.join(tmpDir, wsName)
  /* TODO: only send Diffs if requested by the server or if additional changes were made since the last diff.
   * To do that we can run a git diff, plus untracked file diffs, and get a checksum from each: save and compare on next call.
   * if (!project.diffRequested) return Promise.resolve()
   * if (!(await areChangesSinceLastSent(wsFolder))) return Promise.resolve()
   * project.diffRequested = false
   */
  const { origin } = project
  logger.info('DIFFS: sendDiffs (wsFolder, origin)', wsFolder, origin)
  mkdirp.sync(diffDir)
  const tmpProjectDiff = path.join(diffDir, 'uploaded.diff')
  const emptyFile = path.join(tmpDir, 'empty.p8')

  createEmpty(tmpProjectDiff)
  createEmpty(emptyFile)

  // TODO: get all remotes instead of just origin (take a look at linux repo)
  // TODO: only sendCommitLog at the beginning, and then when the commit history has changed. How do we monitor the git history?
  return sendCommitLog(project)
    .then(cSHA => {
      if (!cSHA) throw new Error('There is no common SHA to diff against. Maybe still not authorized?')
      logger.info('DIFFS: sendDiffs wsFolder=', wsFolder, project)
      return git.command(wsFolder, 'git ls-files --others --exclude-standard')
      // TODO: parse .gitignore and don't add (e.g. dot files) for security reasons
    })
    .then(files => {
      if (!files.length) return
      return gatherUntrackedFiles(files.split(/[\n\r]/).filter(f => f))
    })
    .then(() => {
      logger.info('DIFFS: appending cSHA and diffs (cSHA, wsFolder, tmpProjectDiff)', project.cSHA, wsFolder, tmpProjectDiff)
      return git.command(wsFolder, `git diff -b -U0 --no-color ${project.cSHA} >> ${tmpProjectDiff}`)
      // TODO: maybe also include changes not yet saved (all active editors) / realtime mode ?
    })
    .then(() => {
      const { cSHA } = project
      return uploadDiffs({ origin, diffDir, cSHA, activePath })
    })

  function gatherUntrackedFiles(files) {
    logger.info('DIFFS: gatherUntrackedFiles (files)', files)
    const stream = createWriteStream(tmpProjectDiff)
    const streamPromises = files.map(f => {
      return git
        .command(wsFolder, `git --no-pager diff -b -U0 ${emptyFile} ${f}`)
        .then(e => stream.write(e))
    })
    return Promise
      .all(streamPromises)
      .then(() => {
        logger.info('DIFFS: finished writing all streams')
        return new Promise((resolve, reject) => {
          stream
            .on('error', err => reject(new Error('DIFFS: error streaming files.' + err))) // TODO: is this failing if we simplify to `on('error', reject)` ?
            .on('close', resolve)
            .on('end', resolve)
            .on('finish', resolve)
            .end()
        })
      })
  }
}

/**
 * Uploads the diffs to the server.
 */
function uploadDiffs({ diffDir, origin, cSHA, activePath }): Promise<void> {
  // TODO: I think we sometimes get a file error (cSHA.gz does not exist) -- verify
  const diffFile = path.join(diffDir, 'uploaded.diff')
  const zipFile = path.join(diffDir, `${cSHA}.gz`)
  logger.info('DIFFS: uploadDiffs (diffFile, zipFile)', diffFile, zipFile)
  return compress(diffFile, zipFile)
    .then(() => {
      const zipForm = new FormData()
      zipForm.append('activePath', activePath)
      zipForm.append('origin', origin)
      zipForm.append('sha', cSHA)
      /* @ts-ignore */
      zipForm.append('zipFile', createReadStream(zipFile), { filename: zipFile }) // !! the file HAS to be last appended to FormData
      const options = {
        /* @ts-ignore */
        headers: zipForm.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
      return CAWAPI.axiosAPI
        .post(API_REPO_CONTRIB, zipForm, options)
        .then(res => res.data)
        .catch(err => logger.error('API error in sendDiffs', err)) // TODO: error handling
    })
}

function compress(input: string, output: string): Promise<void> {
  logger.info('DIFFS: compress (input, output)', input, output)
  return new Promise((resolve, reject) => {
    const gzip = createGzip()
    const source = createReadStream(input)
    const destination = createWriteStream(output)
    pipeline(source, gzip, destination, err => {
      logger.info('DIFFS: compress finished; (err ?)', err)
      if (err) reject(err)
      resolve()
    })
  })
}

/************************************************************************************
 * AdHoc Sharing files or folders
 ************************************************************************************/
function shareFile(filePath: string, groups: Array<string>, cid: string) {
  setupShare(filePath, groups, cid)
}

function shareFolder(folder: string, groups: Array<string>, cid) {
  setupShare(folder, groups, cid, true)
}

// TODO: maybe use fs-extra instead
function copyFolder(source: string, dest: string): Promise<string> {
  // TODO: OPTIMIZE: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell)
  return new Promise((resolve, _reject) => {
    const command = `cp -r ${source} ${dest}`
    const options = { windowsHide: true }
    if (isWindows) {
      const ps = new PowerShell({
        debug: true,
        executableOptions: {
          '-ExecutionPolicy': 'Bypass',
          '-NoProfile': true,
        },
      })
      ps.invoke(PowerShell.command`${command}`)
        .then(output => resolve(output as any))
        .catch(error => {
          ps.dispose()
          logger.error('copyFolder exec error', command, error)
        })
    } else {
      childProcess.exec(command, options, (error, stdout, stderr) => {
        if (stderr || error) logger.error('copyFolder exec error', command, error, stderr)
        resolve(stdout)
      })
    }
  })
}

function copyFile(source: string, dest: string): Promise<void> {
  return fs.copyFile(source, dest)
}

/************************************************************************************
 * AdHoc Sharing files or folders for REPO model
 * (for Office model, please see share.controller.js)
 ************************************************************************************/
async function setupShare(fPath: string, groups: any[], cid: string, isFolder = false): Promise<void> {
  // TODO: refactor this and unify the Repo and Office sharing process
  const filename = path.basename(fPath)
  const origin = _.uniqueId(filename + '-') // TODO: this uniqueId only works for multiple sequential calls I think, because it just spits out 1, 2, 3
  const tmpDir = CAWStore.uTmpDir[cid]
  const adhocDir = path.join(tmpDir, 'adhoc') // for adhoc sharing files and folders
  const adhocRepo = path.join(adhocDir, origin)
  const zipFile = path.join(adhocDir, `${origin}.zip`)
  rimraf.sync(adhocRepo)
  mkdirp.sync(adhocRepo)
  const copyOp = isFolder ? copyFolder : copyFile
  await copyOp(fPath, adhocRepo)
  await initGit({ extractDir: adhocRepo, origin })
  await git.command(adhocRepo, `git archive --format zip --output ${zipFile} HEAD`)
  await git.command(adhocRepo, 'git rev-list HEAD -n1')
  // TODO:
  // await CAWAPI.sendAdhocShare({ zipFile, origin, groups })
}

async function initGit({ extractDir, origin }): Promise<void> {
  await git.command(extractDir, 'git init')
  await git.command(extractDir, 'git add .')
  await git.command(extractDir, `git remote add origin ${origin}`)
  await git.command(extractDir, 'git commit -am "initial commit"')
}

async function updateGit(/* extractDir: string */): Promise<void> {
  // await git.command(extractDir, 'git add .') // TODO: this conflicts with initGit in the initial receiving phase
  // await git.command(extractDir, 'git commit -am "updated"') // We'll keep the original commit for now.
}

/************************************************************************************
 * Refresh the peer changes for the active file.
 * 1. Download the changes (line numbers only) from the server (once per SYNC_THRESHOLD)
 * 2. Diff against their respective commits
 * 3. Shift the line markers received from the server, to account for local changes.
 *
 * TODO: cleanup older changes; the user closes tabs (maybe) but we're still keeping
 * the changes in CAWStore (project.changes)
 *
 * @param project object - CAWStore project
 * @param filePath string - the file path of the active document
 * @param doc string - the file contents
 * @param cid string - the client ID
 ************************************************************************************/
const lastDownloadDiff = []
function refreshChanges(project: any, filePath: string, doc: string, cid: string): Promise<void> {
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same contributor) */
  if (!project.cSHA) return Promise.resolve()
  const wsFolder = project.root
  const fpath = filePath.includes(project.root) ? filePath.substr(project.root.length + 1) : filePath
  logger.log('DIFFS: refreshChanges (origin, fpath, user)', project.origin, fpath, CAWStore.user?.email)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  // @ts-ignore
  if (lastDownloadDiff[wsFolder] && new Date() - lastDownloadDiff[wsFolder] < Config.SYNC_THRESHOLD) {
    logger.info('DIFFS: still fresh (lastDownloadDiff, now)', lastDownloadDiff[wsFolder], new Date())
    return Promise.resolve()
  }

  lastDownloadDiff[wsFolder] = new Date()

  return downloadChanges(project, fpath, cid)
    .then(() => {
      logger.info(`DIFFS: will check local diffs for ${fpath}`, project.changes)
      /* perform aggregate diffs instead of the cSHA; users may send diffs and then
       * go offline for a while, which make their diffs stale against an old SHA.
       */
      return getLinesChangedLocaly(project, fpath, doc, cid)
    })
    .then(() => {
      logger.info(`DIFFS: will shift markers (changes) for ${fpath}`, project.changes)
      if (project.changes[fpath]) {
        shiftWithGitDiff(project, fpath)
        shiftWithLiveEdits(project, fpath) // include editing operations since the git diff was initiated
        delete PENDING_DIFFS[fpath] // pending diffs complete
      }
      return project
    })
    .catch(logger.error)
}

/************************************************************************************
 * We download the list of contributors for the active file,
 * and aggregate their changes to display the change markers
 *
 * The response from downloadDiffs API call includes:
 * - tree: list of aggregate changes across all peers
 * - file: list of contributors and their individual changes for the current file
 * - users: list of same contributors with their account details (avatar, email, etc)
 *
 * @param project object - CAWStore project
 * @param fpath string - the file path of the active document
 * @param cid string - the client ID
 ************************************************************************************/
function downloadChanges(project: any, fpath: string, cid: string): Promise<void> {
  const currentUserId = CAWStore.user?._id.toString()
  if (!currentUserId) return Promise.reject(new Error('Not logged in.'))
  const uri = encodeURIComponent(project.origin)
  return CAWAPI.axiosAPI
    .get(`${API_REPO_CONTRIB}?origin=${uri}&fpath=${fpath}&clientId=${cid}`)
    .then((res) => {
      logger.info('DIFFS: downloadDiffs contributors (origin, res.status, fpath, res.data)', project.origin, res.status, fpath, res.data.tree?.length + ' files', Object.keys(res.data.file?.changes).length + ' contributors')
      const { data } = res
      if (!data) return
      // merge contributors
      if (!project.contributors) project.contributors = {}
      data.users.filter(u => u._id !== currentUserId).forEach(u => (project.contributors[u._id] = u))
      project.changes = {}
      data.tree?.forEach(f => project.changes[f.file] || (project.changes[f.file] = {})) // if already exists, don't overwrite
      /**
       * data.file.changes: {
       *   uid1: { sha: sha, lines: lines, s3key: s3key }
       *   uid2: { sha: sha, lines: lines, s3key: s3key }
       *   ...
       * }
       */
      project.changes[fpath] = data.file.changes
      // TODO: when contributors have different cSHA values, we need to diff against each one
      // so aggregate based on cSHA (multiple aggregates)
      const lines = {}
      if (data.file.changes) {
        delete data.file.changes[currentUserId]
        Object.keys(data.file.changes).map(uid => {
          const sha = data.file.changes[uid].sha
          if (!lines[sha]) lines[sha] = []
          data.file.changes[uid].lines.map(line => {
            if (!~lines[sha].indexOf(line)) lines[sha].push(line)
          })
        })
        project.changes[fpath].alines = lines
        logger.info('DIFFS: aggregate lines: (lines, changes[fpath])', lines, project.changes[fpath])
      }
    })
    .catch(err => {
      logger.info('DIFFS: no contributors for this file', err.core, err.config.url, err.data)
    })
}

/************************************************************************************
 * Getting the changes from the active document (not yet written to disk).
 *
 * @param project object - CAWStore project
 * @param fpath string - the file path of the active document
 * @param doc string - the document text content
 * @param cid string - the client ID
 ************************************************************************************/
function getLinesChangedLocaly(project: any, fpath: string, doc: string, cid: string): Promise<void> {
  const wsFolder = project.root
  const wsName = path.basename(wsFolder)
  const tmpDir = CAWStore.uTmpDir[cid]
  if (!project.changes[fpath]) return Promise.resolve()
  /* TODO: right now we're limiting the git archive and diff operations to maximum 20 different commits; optimize and improve if possible */
  const shas = Object.keys(project.changes[fpath].alines).slice(0, Config.MAX_NR_OF_SHA_TO_COMPARE)
  logger.info('DIFFS: getLinesChangedLocaly shas', shas)

  const tmpCompareDir = path.join(tmpDir, wsName, Config.EXTRACT_LOCAL_DIR)
  const activeFile = path.join(tmpCompareDir, fpath)
  mkdirp.sync(path.dirname(activeFile))

  const archiveDir = path.join(tmpDir, wsName, Config.EXTRACT_REPO_DIR)
  mkdirp.sync(archiveDir)

  clearLocalDiffs(project)

  let shaPromise = fs.writeFile(activeFile, doc)

  shas.forEach(sha => {
    const archiveFile = path.join(archiveDir, `_cA.archive-${sha}`)
    shaPromise = shaPromise
      .then(() => {
        logger.info('DIFFS: ARCHIVE', archiveFile, sha, fpath)
        return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${sha} ${fpath}`)
      })
      .then(() => {
        logger.info('DIFFS: tar.x', archiveDir)
        return tar.x({ file: archiveFile, cwd: archiveDir })
      })
      .then(() => {
        logger.info('DIFFS: getLinesChangedLocaly diff', activeFile)
        return git.command(wsFolder, `git diff -b -U0 --no-color --exit-code ${path.join(archiveDir, fpath)} ${activeFile}`)
      })
      .then(parseDiffFile)
      .then(localChanges => {
        logger.info('DIFFS: getLinesChangedLocaly localChanges', localChanges)
        if (!project.gitDiff) project.gitDiff = {}
        if (!project.gitDiff[fpath]) project.gitDiff[fpath] = {}
        project.gitDiff[fpath][sha] = localChanges
      })
      .catch(err => {
        console.log('ERROR IN PARSE DIFFS', err)
        // TODO: improve error control for chained promises
        // when git archive fails it's usually because the ${sha} is not present locally.
        delete project.changes[fpath].alines[sha]
        logger.info('DIFFS: git archive failed', err)
        throw new Error(`Could not git archive with sha: ${sha} ${fpath}`)
      })
  })

  return shaPromise
}

/************************************************************************************
 * Update (shift) the line markers to account for the local edits and git diffs since the cSHA
 * Operation order:
 * - gitDiff
 * - local edits after the git diff was initiated (if the user is quick on keyboard)
 * - aggregate lines
 *
 * @param project object - project
 * @param fpath string - the file path for which we extracted the diffs
 *
 ************************************************************************************/
function shiftWithGitDiff(project: any, fpath: string): void {
  // logger.info('DIFFS: shiftWithGitDiff (project, fpath)', project, fpath)
  if (!project.gitDiff || !project.gitDiff[fpath] || !project.changes[fpath]) return

  const shas = Object.keys(project.changes[fpath].alines).slice(0, Config.MAX_NR_OF_SHA_TO_COMPARE)
  shas.map(sha => {
    const changes = project.changes && project.changes[fpath] || {}
    const gitDiff = project.gitDiff && project.gitDiff[fpath] || {}
    const lines = changes.alines[sha] || []
    const localLines = gitDiff[sha] || []
    project.changes[fpath].alines[sha] = shiftLineMarkers(lines, localLines)
    logger.log('DIFFS: shiftWithGitDiff (localLines, alines, fpath, gitDiff)', localLines, project.changes[fpath].alines, fpath, gitDiff)
  })
}

function shiftWithLiveEdits(project: any, fpath: string): void {
  if (!project.changes || !project.changes[fpath]) return
  const shas = Object.keys(project.changes[fpath].alines).slice(0, Config.MAX_NR_OF_SHA_TO_COMPARE)
  const { editorDiff } = project
  if (!editorDiff || !editorDiff[fpath]) return

  const liveLines = editorDiff[fpath]
  shas.map(sha => {
    const lines = project.changes[fpath].alines[sha] || []
    editorDiff[fpath] = []
    project.changes[fpath].alines[sha] = shiftLineMarkers(lines, liveLines)
    // logger.log('DIFFS: shiftWithLiveEdits (liveLines, alines)', liveLines, project.changes[fpath].alines)
  })
}

function shiftLineMarkers(lines: number[], ranges: any[]): Array<number> {
  let shift = 0
  let pshift = 0 // progressive shift as we go through all diff ranges
  let newLines = []
  logger.log('shiftLineMarkers (lines, ranges)', lines, ranges)
  if (!ranges.length) return lines
  ranges.map(block => {
    shift = block.replaceLen - block.range.len
    console.log('SHIFT', shift, pshift)
    const counted = []
    lines.map((line, i) => {
      if (line + pshift >= block.range.line) {
        lines[i] = Math.max(block.range.line, lines[i] + shift)
        console.log('SHIFT GT', block.range, line, lines[i])
      }
    })
    pshift = shift
    newLines = lines.filter(n => {
      if (!counted[n]) {
        counted[n] = true
        return true
      }
    })
  })

  return newLines
}

function clearLocalDiffs(project: any) {
  project.gitDiff = []
}

type TDiffReplace = {
  range: {
    line: number,
    len: number,
  },
  replaceLen: number,
}

function parseDiffFile(diffs: string): Array<TDiffReplace> {
  const lines = diffs.split('\n')
  const changes = []
  let sLine = 0
  let delLines = 0
  let insLines = 0
  for (const line of lines) {
    const start = line.substring(0, 3)
    if (['---', '+++', 'ind'].includes(start)) continue
    if (line[0] === '-') {
      delLines++
    } else if (line[0] === '+') {
      insLines++
    } else if (start === '@@ ') {
      /* eslint-disable-next-line security/detect-unsafe-regex */
      const matches = /@@ -([0-9]+)(,[0-9]+)? \+([0-9]+)(,[0-9]+)? @@/.exec(line)
      if (delLines || insLines) {
        changes.push({
          range: { line: sLine, len: delLines },
          replaceLen: insLines,
        })
      }
      sLine = parseInt(matches[1], 10)
      delLines = 0
      insLines = 0
    }
  }

  // last bit
  changes.push({
    range: { line: sLine, len: delLines },
    replaceLen: insLines,
  })

  return changes
}

function clear() {
  // TODO
}

async function unzip({ extractDir, zipFile }): Promise<void> {
  logger.info('unzip in ', extractDir)
  const filename = path.basename(zipFile)
  await shell.unzip(filename, extractDir)
  await shell.rmFile(zipFile)
}

// TODO: error handling of all these awaits
// TODO: it seems this crashes when closing the file (with save): `spawn C:\WINDOWS\system32\cmd.exe ENOENT`
async function sendAdhocDiffs(diffDir: string, cid: string): Promise<void> {
  if (lastSendDiff[diffDir]) {
    /* @ts-ignore */
    if (new Date() - lastSendDiff[diffDir] < Config.SYNC_THRESHOLD) return Promise.resolve()
  } else {
    lastSendDiff[diffDir] = new Date()
  }
  const gitDir = path.join(diffDir, Config.EXTRACT_LOCAL_DIR)
  const origin = (await git.command(gitDir, 'git remote get-url origin')).trim()
  const sha = (await git.command(gitDir, 'git rev-list --max-parents=0 HEAD')).trim()
  const tmpProjectDiff = path.join(diffDir, 'uploaded.diff')
  const tmpDir = CAWStore.uTmpDir[cid]
  const emptyFile = path.join(tmpDir, 'empty.p8')

  createEmpty(tmpProjectDiff)
  createEmpty(emptyFile)

  await git.command(gitDir, `git diff -b -U0 --no-color ${sha} >> ${tmpProjectDiff}`)

  return uploadDiffs({
    activePath: '', // TODO: add slide number, and connect to receive updates via socket
    cSHA: sha,
    diffDir,
    origin,
  })
}

// TODO: move PPT related fn into a separate module
async function refreshAdhocChanges({ origin, fpath }): Promise<void> {
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same contributor) */

  logger.log('DIFFS: downloadDiffs ad-hoc (origin, fpath, user)', origin, fpath, CAWStore.user)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  /* @ts-ignore */
  if (lastDownloadDiff[origin] && new Date() - lastDownloadDiff[origin] < Config.SYNC_THRESHOLD) {
    return Promise.resolve()
  }

  lastDownloadDiff[origin] = new Date()

  const uri = encodeURIComponent(origin)
  return CAWAPI
    .axiosAPI(`${API_SHARE_SLIDE_CONTRIB}?origin=${uri}&fpath=${fpath}`, { method: 'GET', responseType: 'json' })
    .then(res => res.data)
}

const CAWDiffs = {
  clear,
  compress,
  diffWithContributor,
  diffWithBranch,
  initGit,
  refreshAdhocChanges,
  refreshChanges,
  shareFile,
  shareFolder,
  sendAdhocDiffs,
  sendCommitLog,
  sendDiffs,
  shiftWithLiveEdits,
  unzip,
  updateGit,
  uploadDiffs, // IMPORTANT: used for mocking purposes in integration tests; use sendDiffs instead
  PENDING_DIFFS,
}

export default CAWDiffs
