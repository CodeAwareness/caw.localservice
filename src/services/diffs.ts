import { mkdirp } from 'mkdirp'
import path from 'path' // TODO: relative path
import tar from 'tar'
import { rimraf } from 'rimraf'
import FormData from 'form-data'
import * as _ from 'lodash'

import { createGzip } from 'zlib'
import { promises as fs, createReadStream, createWriteStream, openSync, closeSync } from 'node:fs'
import { pipeline } from 'stream'
import { AxiosResponse } from 'axios'
// import replaceStream from 'replacestream' // doesn't work (!

import Config from '@/config/config'
import logger from '@/logger'

import git from './git'
import shell from './shell'
import CAWStore from './store'
import CAWAPI, { API_REPO_COMMITS, API_REPO_COMMON_SHA, API_REPO_PEERS, API_REPO_DIFF_FILE } from './api'

const PENDING_DIFFS = {}
const isWindows = !!process.env.ProgramFiles

export type TBlockChange = [
  lineNr: number,
  op: number,
  newLines: number,
] | []

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

let lastDownloadDiff = {}
let lastSendDiff = {}

function formatLocalFile(f: string) {
  return f.replace(/[/\\]/g, '-')
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
  const userFile = project.activePath
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
  const relPath = fpath // already relative from activeProject.activePath
  const cpPath = shell.crossPlatform(fpath)
  const localFName = formatLocalFile(relPath) // TODO: is there a way to guarantee absolutely zero name collision? (do it for all `localFName` in this file)
  const archiveDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, peer._id)
  /* downloadedFile: we save the diffs received from the server to TMP/active.diffs */
  const downloadedFile = path.join(archiveDir, '_caw.active.diffs')
  const changes = project.file.changes[peer._id]
  /* archiveFile: we use git archive to extract the active file from the cSHA commit */
  const archiveFile = path.join(archiveDir, `${localFName}-${changes.sha}.tar`) // TODO: we should retrieve a fresh copy to ensure that the downloaded diff is still corresponding to the SHA
  /* extractDir: we extract the active file from the archive in this folder, so we can run git apply on it */
  const extractDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, peer._id)
  const fdir = path.dirname(relPath)
  rimraf.sync(path.join(extractDir, fdir))
  mkdirp.sync(path.join(extractDir, fdir))
  /* peerFile: we finally instruct VSCode to open a diff window between the active file and the extracted file, which now has applied diffs to it */
  const peerFile = path.join(extractDir, relPath)
  logger.info('DIFFS: extractPeer (ct, relPath, fdir, extractDir)', peer, relPath, fdir, extractDir)

  const uri = encodeURIComponent(origin)
  return CAWAPI.axiosAPI
    .get(`${API_REPO_DIFF_FILE}?origin=${uri}&fpath=${changes.s3key}`)
    .then(saveDownloaded(downloadedFile))
    .then(gitArchive)
    .then(untar)
    .then(applyPeerDiffs)
    .then(assembleFiles)

  function gitArchive() {
    // TODO: if file exists do not archive again (no overwrite necessary)
    return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${changes.sha} ${relPath}`)
  }

  function untar() {
    return tar.x({ file: archiveFile, cwd: extractDir })
  }

  function applyPeerDiffs() {
    // return git.command(extractDir, `git apply --whitespace=nowarn ${downloadedFile}`) // TODO: would be nice if this worked
    const cmd = isWindows ? '"C:\\Program Files\\Git\\usr\\bin\\patch.exe"' : 'patch'
    return git.command(extractDir, `${cmd} -p1 < ${downloadedFile}`)
  }

  function assembleFiles() {
    const title = `CAW#${path.basename(relPath)} ↔ Peer changes`
    logger.info('DIFFS: vscodeOpenDiffs (ct, peerFile, relPath)', peer, peerFile, relPath)
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
      logger.info('DIFFS: rev-list HEAD', head, project.head)
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
function refreshChanges(project: any, fpath: string, doc: string, cid: string): Promise<any> {
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same peer) */
  if (!project.cSHA || !fpath) return Promise.resolve()
  if (!project.dl) project.dl = {}
  const cpPath = shell.crossPlatform(fpath)
  const wsFolder = project.root
  const fullPath = path.join(wsFolder, fpath)
  // Windows and VSCode on Windows have upper and lower case C:/ c:/ or even /c:/ in various versions and contexts.
  logger.log('DIFFS: refreshChanges (origin, fpath, user)', project.origin, fpath, CAWStore.user?.email)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  const tmpDir = CAWStore.uTmpDir[cid]
  const docFile = path.join(tmpDir, Config.EXTRACT_LOCAL_DIR, 'active-doc')
  const context = { project, cpPath, fpath, docFile, cid }
  let tailPromise: Promise<any> = fs.writeFile(docFile, doc)
  // @ts-ignore Typescript too perfect for its own good
  if (lastDownloadDiff[fullPath] && new Date() - lastDownloadDiff[fullPath] < Config.SYNC_THRESHOLD) {
    logger.info('DIFFS: still fresh (lastDownloadDiff, now)', lastDownloadDiff[fullPath], new Date())
  } else {
    lastDownloadDiff[fullPath] = new Date()
    tailPromise = tailPromise.then(() => downloadChanges(context))
  }

  return tailPromise
    .then(() => {
      project.agg   = project.dl[fpath].agg
      project.users = project.dl[fpath].users
      project.file  = project.dl[fpath].file
      project.tree  = project.dl[fpath].tree
    })
    .then(() => applyDiffs(context))
    .then(() => project)
    .catch(logger.error)
}

const saveDownloaded = fpath => res => {
  // console.log('saveDownloaded', fpath)
  return fs.writeFile(fpath, res.data + '\n')
}

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
function downloadChanges(context): Promise<void | AxiosResponse<any, any>> {
  const { project, fpath, cid } = context
  const uriOrigin = encodeURIComponent(project.origin)
  // TODO: combine aggregate and peer list in one call (API side, then here)
  return CAWAPI.axiosAPI
    .get(`${CAWAPI.API_REPO_CHANGES}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`)
    .then(res => {
      project.dl[fpath] = res?.data
      return project
    })
    .catch(err => {
      console.error(err)
      logger.info('DIFFS: no peers for this file.', err.core, err.config?.url, err.data, err)
    })
}

function parseDiffFile(diffs: string): Array<TBlockChange> {
  if (!diffs) return []
  const lines = diffs.split(/\r?\n/)
  const fchanges: Array<TBlockChange> = []
  let cchange: TBlockChange = []
  let bLine = 0
  let cLine = 0
  try {
    for (const line of lines) {
      // console.log(line)
      const start = line.substr(0, 3)
      if (['---', '+++', 'ind'].includes(start)) continue
      if ((bLine < 0) && ['-', '+'].includes(line[0])) {
        bLine = cLine
        cchange = [cLine, 0, 0]
        fchanges.push(cchange)
      }
      if (line[0] === '-') {
        // console.log('LINE REMOVE', cchange)
        cchange[1]-- // increment lines removed on the current block / chunk
        cLine++
      } else if (line[0] === '+') {
        // console.log('LINE ADD', cchange)
        cchange[2]++
        cLine++
      } else if (start === '@@ ') {
        /* eslint-disable-next-line security/detect-unsafe-regex */
        const matches = /@@ -([0-9]+)(,[0-9]+)? \+([0-9]+)(,[0-9]+)? @@/.exec(line)
        cLine = parseInt(matches[1], 10) // extract the first number, which is the line number for the current block of changes
        // const cLen = parseInt((matches[2] || '').replace(',', ''), 10) || 1 // the second number represents the lines that were replaced by changes; if the change is empty, and this number is >0 we read a delete op
        bLine = -1
      } else {
        // With non minimal diffs (when we don't use -U0 flag) we also see some adjecent lines of code that have not changed. We ignore them.
        cLine++
        bLine = -1
      }
    }
  } catch (err) {
    console.error(err)
  }

  return fchanges
}

function clear() {
  // TODO
}

async function unzip({ extractDir, zipFile }): Promise<void> {
  logger.info('DIFFS: unzip in ', extractDir)
  const filename = path.basename(zipFile)
  await shell.unzip(filename, extractDir)
  await shell.rmFile(zipFile)
}

const peerIndex = {}

const nextPeer = (block: TContribBlock) => () => {
  const project = CAWStore.activeProjects[block.cid]
  // const blocks = await Config.localStore.repo?.blocks
  // const peer = await Config.localStore.repo?.currentPeer
  const { users } = project.users
  let i = peerIndex[project.origin]
  if (i === undefined) {
    i = peerIndex[project.origin] = 0
  } else {
    i = peerIndex[project.origin] += block.direction > 0 ? 1 : -1
  }
  if (i >= users.length) peerIndex[project.origin] = 0
  if (i < 0) peerIndex[project.origin] = users.length - 1
  const uid = users[peerIndex[project.origin]]._id
  const { sha, s3key } = project.file.changes[uid]
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
    .then((changes: Array<TBlockChange>) => {
      /*
      const matching = changes.filter(obj => {
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
      */
    })
}

/**
 * We apply diffs on a live document, for each SHA value recorded by peers.
 *
 * TODO: benchmark performance test
 */
async function applyDiffs(context) {
  const { project, fpath, docFile, cid } = context
  project.hl = []
  if (!project.agg) {
    return []
  }
  const tmpDir = CAWStore.uTmpDir[cid]
  const wsFolder = project.root
  const extractDir = path.join(tmpDir, Config.EXTRACT_PEER_DIR, cid)
  try {
    await mkdirp(extractDir)
  } catch (err) {
    // nothing
  }

  const shas = Object.keys(project.agg)

  if (!shas.length) return

  const diffDoc = (shaFile) => git.command(wsFolder, `git diff -b -U0 --no-color --diff-algorithm=patience ${shaFile} ${docFile}`)
  const untar = (sha) => git.command(extractDir, `tar xvf archive-${sha}.tar`)
  const createArchive = (sha) => {
    logger.info('DIFFS: createArchive for ', fpath, 'in folder', extractDir)
    const archiveFile = path.join(extractDir, `archive-${sha}.tar`)
    return git
      .command(wsFolder, `git archive --format=tar -o ${archiveFile} ${sha} ${fpath}`)
      .catch(logger.error)
  }

  const local = {}
  const agg = []
  for (const sha of shas) {
    const peerLines = project.agg[sha]
    await createArchive(sha)
    await untar(sha)
    const shaFile = path.join(extractDir, fpath)
    const diffs = await diffDoc(shaFile)
    const fchanges = parseDiffFile(diffs)
    local[sha] = fchanges
    agg.push(await zipAgg(peerLines, local[sha]))
  }

  const fullList = agg.reduce((acc, list) => _.concat(acc, list), []).sort((a, b) => a - b)
  project.hl = _.sortedUniq(fullList)
  delete project.agg

  return project.hl
}

// TODO: a better use of generators here?
// Rules:
// - local == peer : hl all local
// - local < peer : don't highlight, compute new carry
// - local > peer : highlight with carry
function* extractFromLocalAndPeer(peer, local, carry = 0) {
  let hl: number | number[] = 0
  while (peer[0] !== undefined) {
    if (local[0] === undefined) {
      hl = peer.shift() + carry
      yield hl
    } else if (peer[0] < local[0][0]) {
      hl = peer.shift() + carry
      yield hl
    } else if (peer[0] > local[0][0]) {
      const lnr = local.shift()
      carry += lnr[1] + lnr[2]
      yield* extractFromLocalAndPeer(peer, local, carry)
    } else { // peer line === local line
      const lnr = local.shift()
      if (lnr[1]) {
        // replacement
        hl = Array.from({ length: lnr[2] }, (u, n) => n + lnr[0] + carry)
      } else {
        // insertion
        hl = lnr[0] + carry
      }
      carry += lnr[1] + lnr[2]
      peer.shift()
      yield hl
    }
  }
}

async function zipAgg(peer, local) {
  const it = extractFromLocalAndPeer(peer, local)
  const res = []
  let c
  while ((c = it.next().value) !== undefined) {
    if (c === undefined) return
    if (c instanceof Object) c.forEach(i => res.push(i))
    else res.push(c)
  }

  return res
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

function reset() {
  lastDownloadDiff = {}
  lastSendDiff = {}
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
  reset,
  sendCommitLog,
  sendDiffs,
  unzip,
  updateGit,
  uploadDiffs, // IMPORTANT: used for mocking purposes in integration tests; use sendDiffs instead
  zipAgg, // For testing purposes
  PENDING_DIFFS,
}

export default CAWDiffs
