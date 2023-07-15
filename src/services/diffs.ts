import { mkdirp } from 'mkdirp'
import path, { relative } from 'path' // TODO: relative path
import tar from 'tar'
import { rimraf } from 'rimraf'
import FormData from 'form-data'
import * as _ from 'lodash'

import { createGzip } from 'zlib'
import { PowerShell } from 'node-powershell' // TODO: windows
import childProcess from 'child_process' // TODO: do we still need this?
import { promises as fs, constants as fsConstants, createReadStream, createWriteStream, openSync, closeSync } from 'node:fs'
import { pipeline } from 'stream'
// import { AxiosResponse } from 'axios'
// import replaceStream from 'replacestream' // doesn't work (!

import Config from '@/config/config'
import logger from '@/logger'

import git from './git'
import shell from './shell'
import CAWStore from './store'
import CAWAPI, { API_REPO_COMMITS, API_REPO_COMMON_SHA, API_REPO_PEERS, API_REPO_DIFF_FILE } from './api'
import { config } from 'dotenv' // TODO: do we still need this?

const PENDING_DIFFS = {}
const isWindows = !!process.env.ProgramFiles

export type TDiffBlock = {
  peer: any,
  range: {
    line: number,
    len: number,
    content: string[],
  },
  replaceLen: number,
  /* TODO: I thought to remove the replaceLen; we should be able to handle all edit operations using just `line` and `len`.
   * For example, `len = 0` should mean INSERT, while `len = 1` means REPLACE current line.
   * However, a REPLACE with empty content could mean either "place an empty line there" or "delete that line entirely".
   */
}

export type TContribBlock = {
  origin: string
  fpath: string
  doc: string
  cid: string
  line: number
  direction: number
}

export type TPeerFile = {
  title: string
  extractDir: string
  peerFile: string
  fpath: string
}

/************************************************************************************
 * Diffs active file with the same file in a local branch
 *
 * Open the VSCode standard diff window...
 ************************************************************************************/
async function diffWithBranch({ branch, cid }): Promise<any> {
  let peerFile
  const project = CAWStore.activeProjects[cid]
  const tmpDir = CAWStore.uTmpDir[cid]

  const wsFolder = project.root
  CAWStore.selectedBranch = branch
  CAWStore.selectedPeer = undefined
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
 * Download diff file for one peer, apply the diff patch to create their version.
 *
 * - fpath is the relative path of the currently opened file
 *
 * TODO: this works for VSCode, maybe other editors need a different workflow.
 *
 * TODO: this can be massively optimized.
 *
 * @param { ct: Object, fpath: string, origin: string, doc: string, cid: string }
 *
 * ct = peer: {
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
function extractPeer({ peer, fpath, cid, doc }): Promise<TPeerFile> {
  const tmpDir = CAWStore.uTmpDir[cid]

  const project = CAWStore.activeProjects[cid]
  const origin = project.origin
  const wsFolder = project.root
  const relPath = shell.getRelativePath(fpath, project)
  const localFName = relPath.replace(/[\/\\]/g, '') // TODO: is there a way to guarantee absolutely zero name collision? (do it for all `localFName` in this file)
  const archiveDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, peer._id)
  /* downloadedFile: we save the diffs received from the server to TMP/active.diffs */
  const downloadedFile = path.join(archiveDir, '_caw.active.diffs')
  const changes = project.changes[relPath].file.changes[peer._id]
  /* archiveFile: we use git archive to extract the active file from the cSHA commit */
  const archiveFile = path.join(archiveDir, `${localFName}-${changes.sha}.tar`) // TODO: we should retrieve a fresh copy to ensure that the downloaded diff is still corresponding to the SHA
  /* extractDir: we extract the active file from the archive in this folder, so we can run git apply on it */
  const extractDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, peer._id)
  const fdir = path.dirname(fpath)
  rimraf.sync(path.join(extractDir, fdir))
  mkdirp.sync(path.join(extractDir, fdir))
  /* peerFile: we finally instruct VSCode to open a diff window between the active file and the extracted file, which now has applied diffs to it */
  const peerFile = path.join(extractDir, relPath)
  logger.info('DIFFS: extractPeer (ct, fpath, extractDir)', peer, fpath, extractDir)

  const uri = encodeURIComponent(origin)
  return CAWAPI.axiosAPI
    .get(`${API_REPO_DIFF_FILE}?origin=${uri}&fpath=${changes.s3key}`)
    .then(saveDownloaded(downloadedFile))
    .then(gitArchive)
    .then(untar)
    .then(applyDiffs)
    .then(assembleFiles)

  function gitArchive() {
    // TODO: if file exists do not archive again (no overwrite necessary)
    return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${changes.sha} ${fpath}`)
  }

  function untar() {
    return tar.x({ file: archiveFile, cwd: extractDir })
  }

  function applyDiffs() {
    // return git.command(extractDir, `git apply --whitespace=nowarn ${downloadedFile}`) // TODO: would be nice if this worked
    const cmd = isWindows ? '"C:\\Program Files\\Git\\usr\\bin\\patch.exe"' : 'patch'
    return git.command(extractDir, `${cmd} -p1 < ${downloadedFile}`)
  }

  function assembleFiles() {
    const title = `CAW#${path.basename(fpath)} ↔ Peer changes`
    logger.info('DIFFS: vscodeOpenDiffs (ct, peerFile, fpath)', peer, peerFile, fpath)
    return { title, extractDir, peerFile, fpath: doc }
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
  const diffDir = path.join(tmpDir)
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
      return git.command(wsFolder, 'git ls-files --others --exclude-standard') // this also ignores any files specified in the .gitignore
    })
    .then(files => {
      if (!files.length) return
      return gatherUntrackedFiles(files.split(/[\n\r]/).filter(f => f))
    })
    .then(() => {
      logger.info('DIFFS: appending cSHA and diffs (cSHA, wsFolder, tmpProjectDiff)', project.cSHA, wsFolder, tmpProjectDiff)
      return git.command(wsFolder, `git diff -b -U0 --no-color --diff-algorithm=patience ${project.cSHA} >> ${tmpProjectDiff}`)
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
  logger.info('DIFFS: uploadDiffs (diffFile, zipFile, origin, activePath)', diffFile, zipFile, origin, activePath)
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
        .post(API_REPO_PEERS, zipForm, options)
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
 * 1. Download the diffs from the server (once per SYNC_THRESHOLD)
 * 2. Apply diff against their respective commits, to obtain the peer file
 * 3. Diff peer file against the current doc
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
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same peer) */
  if (!project.cSHA) return Promise.resolve()
  const wsFolder = project.root
  // Windows and VSCode on Windows have upper and lower case C:/ c:/ or even /c:/ in various versions and contexts.
  // We do a lowercase comparison to be sure, but this may affect projects on case sensitive filesystems.
  const fpath = filePath.toLowerCase().includes(project.root.toLowerCase()) ? filePath.substr(project.root.length + 1) : filePath
  logger.log('DIFFS: refreshChanges (origin, fpath, user)', project.origin, fpath, CAWStore.user?.email)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  const tmpDir = CAWStore.uTmpDir[cid]
  const docFile = path.join(tmpDir, Config.EXTRACT_LOCAL_DIR, 'active-doc')
  const retPromise = fs.writeFile(docFile, doc)
  let tailPromise: Promise<any> = retPromise
  // @ts-ignore
  if (lastDownloadDiff[wsFolder] && new Date() - lastDownloadDiff[wsFolder] < Config.SYNC_THRESHOLD) {
    logger.info('DIFFS: still fresh (lastDownloadDiff, now)', lastDownloadDiff[wsFolder], new Date())
  } else {
    lastDownloadDiff[wsFolder] = new Date()
    tailPromise = retPromise.then(() => downloadChanges(project, fpath, cid))
  }

  tailPromise = tailPromise.then(() => {
    logger.info(`DIFFS: will check local diffs for ${fpath}`)
    return applyDiffs({ fpath, cid, doc: docFile })
  })

  tailPromise = tailPromise.then(() => {
    return project
  })

  tailPromise.catch(logger.error)

  return tailPromise
}

const saveDownloaded = fpath => res => fs.writeFile(fpath, res.data + '\n')

/************************************************************************************
 * We download the list of peers for the active file,
 * and aggregate their changes to display the change markers
 *
 * The response from downloadDiffs API call includes:
 * - tree: list of aggregate changes across all peers
 * - file: list of peers and their individual changes for the current file
 * - users: list of same peers with their account details (avatar, email, etc)
 *
 * @param project object - CAWStore project
 * @param fpath string - the file path of the active document
 * @param cid string - the client ID
 ************************************************************************************/
function downloadChanges(project: any, fpath: string, cid: string): Promise<void | any[]> {
  const currentUserId = CAWStore.user?._id.toString()
  if (!currentUserId) return Promise.reject(new Error('Not logged in.'))
  const uri = encodeURIComponent(project.origin)
  const tmpDir = CAWStore.uTmpDir[cid]
  const downloadRoot = path.join(tmpDir, Config.EXTRACT_DOWNLOAD_DIR)

  return CAWAPI.axiosAPI
    .get(`${API_REPO_PEERS}?origin=${uri}&fpath=${fpath}&clientId=${cid}`)
    .then((res) => {
      logger.info('DIFFS: downloadDiffs peers (origin, res.status, fpath, res.data)', project.origin, res.status, fpath, res.data.tree?.length + ' files', Object.keys(res.data.file?.changes).length + ' peers')
      const { data } = res
      if (!data) return
      // merge peers
      if (!project.peers) project.peers = {}
      data.users.filter(u => u._id !== currentUserId).forEach(u => (project.peers[u._id] = u))
      if (!project.changes) project.changes = {}
      // Setup file tree for this repository. When asking for changes on a file, we take the opportunity to refresh the peer file tree as well.
      data.tree?.forEach(f => (project.changes[f.file] || (project.changes[f.file] = {}))) // We don't overwrite the existing File tree (VSCode left panel)
      /**
       * data.file.changes: {
       *   uid1: { sha: sha, lines: lines, s3key: s3key }
       *   uid2: { sha: sha, lines: lines, s3key: s3key }
       *   ...
       * }
       */
      project.changes[fpath] = { users: data.users, file: data.file }

      const promises = []
      promises.push(
        // TODO: this has the potential of crashing when the user shuffles through files quickly
        rimraf(downloadRoot) // TODO: on windows we should be using `rimraf.windows.sync(...)
          .then(() => fs.mkdir(downloadRoot))
      )
      Object.keys(data.file.changes).forEach(uid => {
        const s3key = data.file.changes[uid].s3key
        const downloadedFile = path.join(downloadRoot, `${uid}.diff`)
        promises.push(
          CAWAPI.axiosAPI
            .get(`${API_REPO_DIFF_FILE}?origin=${uri}&fpath=${s3key}`)
            .then(saveDownloaded(downloadedFile))
        )
      })

      /* eslint-disable-next-line @typescript-eslint/no-empty-function */
      return Promise.allSettled(promises)
    })
    .catch(err => {
      console.trace()
      logger.info('DIFFS: no peers for this file.', err.core, err.config?.url, err.data, err)
    })
}

function parseDiffFile(diffs: string): Array<TDiffBlock> {
  logger.info('Parsing diff file of length', diffs.length)
  const lines = diffs.split('\n')
  const changes = []
  let sLine = 0
  let delLines = 0
  let insLines = 0
  let content = []
  for (const line of lines) {
    const start = line.substring(0, 3)
    if (['---', '+++', 'ind'].includes(start)) continue
    if (line[0] === '-') {
      delLines++
    } else if (line[0] === '+') {
      insLines++
      content.push(line.substr(1))
    } else if (start === '@@ ') {
      /* eslint-disable-next-line security/detect-unsafe-regex */
      const matches = /@@ -([0-9]+)(,[0-9]+)? \+([0-9]+)(,[0-9]+)? @@/.exec(line)
      if (delLines || insLines) {
        changes.push({
          range: { line: sLine, len: delLines, content },
          replaceLen: insLines,
        })
        content = []
      }
      sLine = parseInt(matches[1], 10)
      delLines = 0
      insLines = 0
      content = []
    }
  }

  // last bit
  changes.push({
    range: { line: sLine, len: delLines, content },
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

const peers = {}

const nextPeer = (block: TContribBlock) => fpath => {
  const project = CAWStore.activeProjects[block.cid]
  // const blocks = await Config.repoStore.get('blocks')
  // const peer = await Config.repoStore.get('currentPeer')
  const relPath = shell.getRelativePath(block.fpath, project)
  const changes = project.changes[relPath]
  const { users } = changes
  let i = peers[project.origin]
  if (i === undefined) {
    i = peers[project.origin] = 0
  } else {
    i = peers[project.origin] += block.direction > 0 ? 1 : -1
  }
  if (i >= users.length) peers[project.origin] = 0
  if (i < 0) peers[project.origin] = users.length - 1
  const uid = users[peers[project.origin]]._id
  const { sha, s3key } = project.changes[relPath].file.changes[uid]
  return  {
    _id: uid,
    changes: { sha, s3key },
  }
}

async function cycleBlock(block: TContribBlock, start?: number) {
  const project = CAWStore.activeProjects[block.cid]
  const tmpDir = CAWStore.uTmpDir[block.cid]
  const docFile = path.join(tmpDir, Config.EXTRACT_LOCAL_DIR, 'active-doc')
  let peerInfo
  return fs.writeFile(docFile, block.doc)
    .then(nextPeer(block))
    .then(peer => {
      if (!start) start = peer._id
      peerInfo = {
        fpath: block.fpath,
        cid: block.cid,
        doc: docFile,
        peer,
      }
      return extractPeer(peerInfo)
    })
    .then((data: TPeerFile) => {
      const wsFolder = project.root
      // Peer file is extracted in data.peerFile
      // Current doc is written in data.fpath
      return git.command(wsFolder, `git diff -b -U0 --no-color --diff-algorithm=patience ${data.fpath} ${data.peerFile}`)
    })
    .then(parseDiffFile)
    .then(ranges => {
      const matching = ranges.filter(obj => {
        const start = obj.range.line
        const end = (obj.range.line || 1) + obj.range.len
        return start <= block.line && end >= block.line
      })
      if (!matching || !matching[0]) {
        if (peerInfo.peer._id === start) return // TODO: why does this happen? (cycling with no matching peer blocks)
        return cycleBlock(block, start)
      }
      matching[0].peer = peerInfo.peer
      return matching[0]
    })
}

/**
 * We apply diffs on a live document sent to us by the client.
 * The diffs are applied against each peer version. These versions have been downloaded already before calling this function.
 *
 * TODO: sequential execution: for many peers to the same file, these diffs running concurrently will overwhelm the local machine
 */
function applyDiffs({ cid, fpath, doc }) {
  const tmpDir = CAWStore.uTmpDir[cid]
  const project = CAWStore.activeProjects[cid]
  const wsFolder = project.root
  const changes = project.changes[fpath]?.file?.changes
  const downloadRoot = path.join(tmpDir, Config.EXTRACT_DOWNLOAD_DIR)

  if (!changes) return

  // The response from the server contains all users, including current user, which we don't need to process here.
  const { _id } = CAWStore.user
  delete changes[_id]
  const index = project.changes[fpath].users.findIndex(el => el._id === _id)
  if (index !== -1) project.changes[fpath].users.splice(index, 1)

  return Promise.all(Object.keys(changes).map(applyUserChanges))
    .then(aggregateLines)

  async function applyUserChanges(uid) {
    const { sha } = changes[uid]
    const extractDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, uid)
    const archiveDir = extractDir
    try {
      await mkdirp(archiveDir)
    } catch (err) {
      // nothing
    }

    const localFName = fpath.replace(/[\/\\]/g, '')
    const downloadedFile = path.join(downloadRoot, `${uid}.diff`)
    /* archiveFile: we use git archive to extract the active file from the cSHA commit */
    const archiveFile = path.join(archiveDir, `${localFName}-${sha}.tar`)
    /* peerFile: this is the peer version of `fpath` diffs applied */
    const peerFile = path.join(extractDir, fpath)
    const shaFile = peerFile // the original file as it existed at SHA; later on we patch this file and it becomes peerFile as it exists currently in the peer's file system.

    const patchFile = () => {
      // return git.command(extractDir, `git apply --whitespace=nowarn ${downloadedFile}`) // TODO: would be nice if this worked
      const cmd = isWindows ? '"C:\\Program Files\\Git\\usr\\bin\\patch.exe"' : 'patch'
      return git.command(extractDir, `${cmd} ${fpath} ${downloadedFile}`)
    }

    let docDiffs, peerDiffs

    // we have the fpath file as it existed at SHA, currently extracted in the `extractDir`; we make two diffs and return the difference between them.
    const diffDoc = () => git.command(wsFolder, `git diff -b -U0 --no-color --diff-algorithm=patience ${doc} ${shaFile}`)
    const diffPeer = () => fs.readFile(downloadedFile, 'utf-8')
    // TODO: when the current user has changed a line in the same way a peer did,
    // we end up showing highlights for that line anyway, because there is indeed a change relative to the cSHA.
    // This is a source of confusion for the end user, which we should try to eliminate.

    const saveDocDiffs = diffs => (docDiffs = diffs)
    const savePeerDiffs = diffs => (peerDiffs = diffs)

    const updateProject = () => {
      if (!docDiffs.length) {
        changes[uid].diffs = peerDiffs
        return
      }
      // re-index peer diffs taking into account the current doc diffs against the same SHA
      let docCursor = 0
      const diffs = peerDiffs.map(diff => {
        for (let i = docCursor; i < docDiffs.length; docCursor = ++i) {
          if (docDiffs[i].range.line < diff.range.line) diff.range.line += docDiffs[i].replaceLen - docDiffs[i].range.len
        }
        return diff
      })
      // assign the re-indexed ranges to the project changes for this file
      changes[uid].diffs = diffs
    }

    const createArchive = () => {
      return git
        .command(wsFolder, `git archive --format=tar -o ${archiveFile} ${sha} ${fpath}`)
        .then(archiveExists)
        .catch(logger.error)
    }

    const archiveExists = (data) => {
      logger.info('DIFFS: archiveExists: (ct, fpath, extractDir)', changes[uid], fpath, extractDir)
      const untar = () => {
        return git.command(extractDir, `tar xvf ${localFName}-${sha}.tar`)
      }

      return untar()
        .then(diffDoc)
        .then(parseDiffFile)
        .then(saveDocDiffs)
        .then(patchFile)
        .then(diffPeer)
        .then(parseDiffFile)
        .then(savePeerDiffs)
        .then(updateProject)
        .catch(err => console.log('ERROR IN ACHIVE EXISTS', err))
    }

    return fs
      .access(archiveFile, fsConstants.R_OK) // TODO: benchmark this, it's probably too small of an improvement to keep this, we should simply the code if there's only a few ms difference.
      .then(archiveExists)
      .catch(createArchive)
  }

  function aggregateLines() {
    const alines = {}
    Object.keys(changes).forEach(uid => {
      changes[uid].diffs.map(diff => {
        alines[diff.range.line] = 1
        for (let i=0; i<diff.range.len; i++) alines[diff.range.line + i] = 1
      })
    })
    project.changes[fpath].alines = Object.keys(alines)?.map(l => parseInt(l, 10))
  }
}

/**
 * to a temp file and run a diff between it and a peer version.
 * @param Object { peer: object, fpath: string, origin: string, cid: string, doc: string }
 */
async function diffWithPeer({ peer, fpath, cid }) {
  const tmpDir = CAWStore.uTmpDir[cid]
  const tmpFilename = _.uniqueId(path.basename(fpath))
  try {
    await fs.mkdir(path.join(tmpDir, 'tmp'))
  } catch {
    // folder exists; nothing to do.
  }
  const tmpDoc = path.join(tmpDir, 'tmp', tmpFilename)
  return extractPeer({
    peer,
    fpath,
    cid,
    doc: tmpDoc,
  })
}

const CAWDiffs = {
  applyDiffs,
  clear,
  compress,
  cycleBlock,
  diffWithPeer,
  diffWithBranch,
  downloadChanges,
  initGit,
  refreshChanges,
  sendCommitLog,
  sendDiffs,
  unzip,
  updateGit,
  uploadDiffs, // IMPORTANT: used for mocking purposes in integration tests; use sendDiffs instead
  PENDING_DIFFS,
}

export default CAWDiffs
