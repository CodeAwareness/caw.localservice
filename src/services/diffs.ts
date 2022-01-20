import mkdirp from 'mkdirp'
import path from 'path'
import tar from 'tar'
import rimraf from 'rimraf'
import _ from 'lodash'
import { createGzip } from 'zlib'
import { PowerShell } from 'node-powershell'
import childProcess from 'child_process'
import { promises as fs, createReadStream, createWriteStream, openSync, closeSync } from 'fs'
import { pipeline } from 'stream'
// import replaceStream from 'replacestream' // doesn't work (!

import Config from '@/config/config'

import git from './git'
import shell from './shell'
import { CΩStore } from './cA.store'
import CΩAPI from './api'

const logger = console

const PENDING_DIFFS = {}
const isWindows = !!process.env.ProgramFiles

/************************************************************************************
 * Initialization
 *
 * - an empty file that we'll use to create unified diffs against untracked git files.
 * - an adhoc sharing folder; we copy the file or folder being shared here,
 *   and create a git repo, while refreshing with changes made on the originals.
 ************************************************************************************/

const tmpDir = CΩStore.tmpDir
const emptyFile = path.join(tmpDir, 'empty.p8')
const adhocDir = path.join(tmpDir, 'adhoc') // for adhoc sharing files and folders

/************************************************************************************
 * Diffs active file with the same file in a local branch
 *
 * Open the VSCode standard diff window...
 ************************************************************************************/
function diffWithBranch(branch: string): Promise<any> {
  let peerFile
  let wsFolder = CΩStore.activeProject.root
  CΩStore.selectedBranch = branch
  CΩStore.selectedContributor = undefined
  const userFile = CΩStore.activeProject.activePath
  return git.command(path.join(wsFolder, path.dirname(userFile)), 'git rev-parse --show-toplevel')
    .then(folder => {
      wsFolder = folder.trim()
      const name = path.basename(wsFolder)
      const relativeDir = userFile.substr(0, userFile.length - path.basename(userFile).length)
      const localDir = path.join(tmpDir, name, Config.EXTRACT_BRANCH_DIR)
      mkdirp.sync(path.join(localDir, relativeDir))
      peerFile = path.join(tmpDir, name, Config.EXTRACT_BRANCH_DIR, userFile)
      return git.command(wsFolder, `git --work-tree=${localDir} checkout ${branch} -- ${userFile}`)
    })
    .then(() => {
      // TODO: do something with the stderr?
      const title = `CΩ#${path.basename(userFile)} ↔ Peer changes`
      return { title, peerFile, userFile: path.join(wsFolder, userFile) }
    })
    .catch(logger.error)
}

/************************************************************************************
 * diffWithContributor - Diffs active file with the same file at a peer.
 *
 * @param { ct: Object, userFile: string, origin: string, wsFolder: string }
 *
 * - userFile is the relative path of the currently opened file (or ppt slide)
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
 ************************************************************************************/
function diffWithContributor({ ct, userFile, origin, wsFolder }): Promise<any> {
  // !!!!! CΩWorkspace.selectContributor(ct)
  const wsName = path.basename(wsFolder)
  const archiveDir = path.join(tmpDir, wsName)
  mkdirp.sync(archiveDir)
  /* downloadedFile: we save the diffs received from the server to TMP/active.diffs */
  const downloadedFile = path.join(archiveDir, '_cA.active.diffs')
  /* archiveFile: we use git archive to extract the active file from the cSHA commit */
  const archiveFile = path.join(archiveDir, `local-${ct.s}.tar`)
  /* extractDir: we extract the active file from the archive in this folder, so we can run git apply on it */
  const extractDir = path.join(archiveDir, Config.EXTRACT_PEER_DIR, ct._id)
  rimraf.sync(extractDir)
  mkdirp.sync(path.join(extractDir, path.dirname(userFile)))
  /* peerFile: we finally instruct VSCode to open a diff window between the active file and the extracted file, which now has applied diffs to it */
  const peerFile = path.join(extractDir, userFile)
  logger.log('DIFFS: diffWithContributor (ct, userFile, extractDir)', ct, userFile, extractDir)

  return CΩAPI
    .downloadDiffFile({ origin, fpath: ct.k })
    .then(saveDownloaded)
    .then(gitArchive)
    .then(untar)
    .then(applyDiffs)
    .then(vscodeOpenDiffs)
    .catch(console.error)

  function saveDownloaded({ data }) {
    return fs.writeFile(downloadedFile, data + '\n')
  }

  function gitArchive() {
    return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${ct.s} ${userFile}`)
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
    const title = `CΩ#${path.basename(userFile)} ↔ Peer changes`
    logger.log('DIFFS: vscodeOpenDiffs (ct, peerFile, userFile)', ct, peerFile, userFile)
    return { title, extractDir, peerFile, userFile: path.join(wsFolder, userFile) }
  }
}

/************************************************************************************
 * Send Commmit Log to the server
 *
 * We're sending a number of commit SHA values (e.g. latest 100) to the server,
 * in order to compute the common ancestor SHA for everyone in a team.
 ************************************************************************************/
function sendCommitLog(project): Promise<string> {
  // TODO: make MAX_COMMITS something configurable by the server instead. That way we can automatically accommodate a rescale in team size.
  const MAX_COMMITS = 1000
  const wsFolder = project.root
  const { origin } = project
  let localBranches, currentBranch

  logger.log('DIFFS: sendCommitLog (wsFolder)', wsFolder)
  return git.command(wsFolder, 'git rev-list HEAD -n1')
    .then(sha => {
      const head = sha.trim()
      if (project.head === head) {
        return fetchCommonSHA()
      } else {
        // only send the commit log when there are new commits from previous send
        project.head = head
        return sendLog(head)
      }
    })
    .catch(err => {
      logger.error(err)
      throw new Error(err)
    })

  function fetchCommonSHA() {
    return CΩAPI
      .findCommonSHA(origin)
      .then(res => {
        project.cSHA = res.data.sha || project.head
        logger.log('DIFF: getCommonSHA for (origin, cSHA)', project.origin, project.cSHA)
        return project.cSHA
      })
  }

  function sendLog(head) {
    logger.log('DIFFS: sendLog HEAD (origin, head)', project.origin, project.head)
    return git.command(wsFolder, 'git branch --verbose --no-abbrev --no-color')
      .then(extractLog)
      .then(upload)
      .then(res => {
        logger.log('DIFFS: uploadLog received a cSHA from the server (origin, sha)', project.origin, res.data)
        project.cSHA = res.data || project.head
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

  function upload(stdout) {
    const commits = stdout.split(/[\n\r]/).filter(l => l)
    return CΩAPI.sendCommitLog({
      origin,
      commits,
      branches: localBranches,
      branch: currentBranch,
    })
  }
}

function createEmpty(file) {
  closeSync(openSync(file, 'w'))
}

/************************************************************************************
 * sendDiffs
 *
 * @param Object - CΩStore project
 *
 * We're running a git diff against the common SHA, archive this with gzip
 * and send it to the server.
 * TODO: OPTIMIZATION: send only the file that was just saved (if file save event)
 * or the files modified (if file system event)
 ************************************************************************************/
const lastSendDiff = []
function sendDiffs(project): Promise<void> {
  if (!project) return Promise.resolve()
  const wsFolder = project.root
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
  const { origin } = project
  logger.log('DIFFS: sendDiffs (wsFolder, origin)', wsFolder, origin)
  mkdirp.sync(diffDir)
  const tmpProjectDiff = path.join(diffDir, 'uploaded.diff')

  createEmpty(tmpProjectDiff)
  createEmpty(emptyFile)

  // TODO: get all remotes instead of just origin
  // TODO: only sendCommitLog at the beginning, and then when the commit history has changed. How do we monitor the git history?
  return sendCommitLog(project)
    .then(() => {
      return git.command(wsFolder, 'git ls-files --others --exclude-standard')
      // TODO: parse .gitignore and don't add (e.g. dot files) for security reasons
    })
    .catch(error => {
      throw new Error(`Error while sendingCommitLog (command ls-files). ${error}`)
    })
    .then(files => {
      if (!files.length) return
      return gatherUntrackedFiles(files.split(/[\n\r]/).filter(f => f))
    })
    .catch(error => {
      throw new Error(`Error while sendingCommitLog (gatherUntrackedFiles). ${error}`)
    })
    .then(() => {
      logger.info('DIFFS: appending cSHA and diffs (cSHA, wsFolder, tmpProjectDiff)', project.cSHA, wsFolder, tmpProjectDiff)
      return git.command(wsFolder, `git diff -b -U0 --no-color ${project.cSHA} >> ${tmpProjectDiff}`)
      // TODO: maybe also include changes not yet saved (all active editors) / realtime mode ?
    })
    .catch(error => {
      throw new Error(`Error while sendingCommitLog (command diff). ${error}`)
    })
    .then(() => {
      const { cSHA } = project
      return uploadDiffs({ origin, diffDir, cSHA, activePath })
    })
    .catch(error => {
      throw new Error(`Error while sendingCommitLog (uploadDiffs). ${error}`)
    })

  function gatherUntrackedFiles(files) {
    logger.log('DIFFS: gatherUntrackedFiles (files)', files)
    const stream = createWriteStream(tmpProjectDiff)
    const streamPromises = files.map(f => {
      return git
        .command(wsFolder, `git --no-pager diff -b -U0 ${emptyFile} ${f}`)
        .then(e => stream.write(e))
    })
    return Promise
      .all(streamPromises)
      .then(() => {
        logger.log('DIFFS: finished writing all streams')
        return new Promise((resolve, reject) => {
          stream
            .on('error', err => reject(new Error('DIFF: error streaming files.' + err))) // TODO: is this failing if we simplify to `on('error', reject)` ?
            .on('close', resolve)
            .on('end', resolve)
            .on('finish', resolve)
            .end()
        })
      })
  }
}

function uploadDiffs({ diffDir, origin, cSHA, activePath }): Promise<void> {
  // TODO: I think we sometimes get a file error (cSHA.gz does not exist) -- verify
  const diffFile = path.join(diffDir, 'uploaded.diff')
  const zipFile = path.join(diffDir, `${cSHA}.gz`)
  return compress(diffFile, zipFile)
    .then(() => {
      return CΩAPI.sendDiffs({ zipFile, cSHA, origin, activePath })
    })
}

function compress(input: string, output: string): Promise<void> {
  logger.log('DIFFS: compress (input, output)', input, output)
  return new Promise((resolve, reject) => {
    const gzip = createGzip()
    const source = createReadStream(input)
    const destination = createWriteStream(output)
    pipeline(source, gzip, destination, err => {
      logger.log('DIFFS: compress finished; (err ?)', err)
      if (err) reject(err)
      resolve()
    })
  })
}

/************************************************************************************
 * AdHoc Sharing files or folders
 ************************************************************************************/
function shareFile(filePath: string, groups: Array<string>) {
  setupShare(filePath, groups)
}

function shareFolder(folder: string, groups: Array<string>) {
  setupShare(folder, groups, true)
}

// TODO: maybe use fs-extra instead
function copyFolder(source, dest): Promise<string> {
  // TODO: OPTIMIZE: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell)
  return new Promise((resolve, reject) => {
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
          console.error('copyFolder exec error', command, error)
        })
    } else {
      childProcess.exec(command, options, (error, stdout, stderr) => {
        if (stderr || error) console.error('copyFolder exec error', command, error, stderr)
        resolve(stdout)
      })
    }
  })
}

function copyFile(source, dest): Promise<void> {
  return fs.copyFile(source, dest)
}

/************************************************************************************
 * AdHoc Sharing files or folders for REPO model
 * (for Office model, please see share.controller.js)
 ************************************************************************************/
async function setupShare(fPath, groups, isFolder = false): Promise<void> {
  // TODO: refactor this and unify the Repo and Office sharing process
  const filename = path.basename(fPath)
  const origin = _.uniqueId(filename + '-') // TODO: this uniqueId only works for multiple sequential calls I think, because it just spits out 1, 2, 3
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
  // await CΩAPI.sendAdhocShare({ zipFile, origin, groups })
}

async function initGit({ extractDir, origin }): Promise<void> {
  await git.command(extractDir, 'git init')
  await git.command(extractDir, 'git add .')
  await git.command(extractDir, `git remote add origin ${origin}`)
  await git.command(extractDir, 'git commit -am "initial commit"')
}

async function updateGit(extractDir: string): Promise<void> {
  // await git.command(extractDir, 'git add .') // TODO: this conflicts with initGit in the initial receiving phase
  // await git.command(extractDir, 'git commit -am "updated"') // We'll keep the original commit for now.
}

/************************************************************************************
 * refreshChanges
 *
 * @param object - CΩStore project
 * @param string - the file path of the active document
 *
 * Refresh the peer changes for the active file.
 * 1. Download the changes (line numbers only) from the server
 * 2. Diff against the common SHA
 * 3. Shift the line markers received from the server, to account for local changes.
 *
 * TODO: cleanup older changes; the user closes tabs (maybe) but we're still keeping
 * the changes in CΩStore (project.changes)
 ************************************************************************************/
const lastDownloadDiff = []
function refreshChanges(project: any, fpath: string, doc: string): Promise<void> {
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same contributor) */
  const wsFolder = project.root

  logger.log('DIFFS: downloadDiffs (origin, fpath, user)', project.origin, fpath, CΩStore.user)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  /* @ts-ignore */
  if (lastDownloadDiff[wsFolder] && new Date() - lastDownloadDiff[wsFolder] < Config.SYNC_THRESHOLD) {
    return Promise.resolve()
  }

  lastDownloadDiff[wsFolder] = new Date()

  return downloadLinesChanged(project, fpath)
    .then(() => {
      return getLinesChangedLocaly(project, fpath, doc)
    })
    .then(() => {
      logger.log('DIFFS: will shift markers (changes)', project.changes[fpath])
      shiftWithGitDiff(project, fpath)
      shiftWithLiveEdits(project, fpath) // include editing operations since the git diff was initiated
      delete PENDING_DIFFS[fpath] // pending diffs complete
    })
    .catch(console.error)
}

/************************************************************************************
 * downloadLinesChanged
 *
 * @param object - CΩStore project
 * @param string - the file path of the active document
 *
 * We download the list of contributors for the active file,
 * and aggregate their changes to display the change markers
 ************************************************************************************/
function downloadLinesChanged(project, fpath): Promise<void> {
  const currentUserId = CΩStore.user._id.toString()
  return CΩAPI
    .downloadDiffs({ origin: project.origin, fpath })
    .then(({ data }) => {
      logger.info('DIFFS: downloadDiffs contributors (origin, fpath, data.file.c)', project.origin, data && data.file.f, data && data.file.c)
      if (!data) return
      const fpath = data.file.f
      project.contributors[fpath] = data.users.filter(u => u._id.toString() !== currentUserId)
      if (!project.changes) project.changes = {}
      /**
       * data.file.c: {
       *   uid1: { s: sha, l: lines, k: s3key }
       *   uid2: { s: sha, l: lines, k: s3key }
       *   ...
       * }
       */
      project.changes[fpath] = data.file.c
      // TODO: when contributors have different cSHA values, we need to diff against each one
      // so aggregate based on cSHA (multiple aggregates)
      const lines = {}
      if (data.file.c) {
        delete data.file.c[currentUserId]
        Object.keys(data.file.c).map(uid => {
          const sha = data.file.c[uid].s
          if (!lines[sha]) lines[sha] = []
          data.file.c[uid].l.map(line => {
            if (!~lines[sha].indexOf(line)) lines[sha].push(line)
          })
        })
        project.changes[fpath].alines = lines
        logger.log('DIFFS: aggregate lines: (lines, changes[fpath])', lines, project.changes[fpath])
      }
    })
    .catch(err => {
      logger.log('DIFFS: no contributors for this file', err)
    })
}

/************************************************************************************
 * getLinesChangedLocaly
 *
 * @param object - CΩStore project
 * @param string - the file path of the active document
 *
 * Getting the changes from the active document (not yet written to disk).
 ************************************************************************************/
function getLinesChangedLocaly(project, fpath, doc): Promise<void> {
  const wsFolder = project.root
  const wsName = path.basename(wsFolder)
  if (!project.changes[fpath]) return Promise.resolve()
  /* TODO: right now we're limiting the git archive and diff operations to maximum 5 different commits; optimize and improve if possible */
  const shas = Object.keys(project.changes[fpath].alines).slice(0, Config.MAX_NR_OF_SHA_TO_COMPARE)
  logger.log('DIFFS: getLinesChangedLocaly shas', shas)

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
        logger.log('DIFFS: ARCHIVE', archiveFile, sha, fpath)
        return git.command(wsFolder, `git archive --format=tar -o ${archiveFile} ${sha} ${fpath}`)
      })
      .catch(err => {
        // TODO: improve error control for chained promises
        // when git archive fails it's usually because the ${sha} is not present locally.
        delete project.changes[fpath].alines[sha]
        logger.log('DIFFS: git archive failed', err)
        throw new Error(`Could not git archive with sha: ${sha} ${fpath}`)
      })
      .then(() => {
        logger.log('DIFFS: tar.x', archiveDir)
        return tar.x({ file: archiveFile, cwd: archiveDir })
      })
      .then(() => {
        logger.log('DIFFS: getLinesChangedLocaly diff', activeFile)
        return git.command(wsFolder, `git diff -b -U0 ${path.join(archiveDir, fpath)} ${activeFile}`)
      })
      .then(parseDiffFile)
      .then(localChanges => {
        logger.log('DIFFS: getLinesChangedLocaly localChanges', localChanges)
        if (!project.gitDiff) project.gitDiff = {}
        if (!project.gitDiff[fpath]) project.gitDiff[fpath] = {}
        project.gitDiff[fpath][sha] = localChanges
      })
      .catch(err => {
        logger.warn('DIFFS: local git diff failed', err)
      })
  })

  return shaPromise
}

/*
 * shiftWithGitDiff
 *
 * @param object - project
 * @param string - the file path for which we extracted the diffs
 *
 * Update (shift) the line markers to account for the local edits and git diffs since the cSHA
 * Operation order:
 * - gitDiff
 * - local edits after the git diff was initiated (if the user is quick on keyboard)
 * - aggregate lines
 */
function shiftWithGitDiff(project, fpath): void {
  // logger.log('DIFFS: shiftWithGitDiff (project.gitDiff, fpath, project.changes)', project.gitDiff, fpath, project.changes[fpath])
  if (!project.gitDiff || !project.gitDiff[fpath] || !project.changes[fpath]) return

  const shas = Object.keys(project.changes[fpath].alines).slice(0, Config.MAX_NR_OF_SHA_TO_COMPARE)
  shas.map(sha => {
    const changes = project.changes && project.changes[fpath] || {}
    const gitDiff = project.gitDiff && project.gitDiff[fpath] || {}
    const lines = changes.alines[sha] || []
    const localLines = gitDiff[sha] || []
    project.changes[fpath].alines[sha] = shiftLineMarkers(lines, localLines)
    // logger.log('DIFFS: shiftWithGitDiff (localLines, alines, fpath)', localLines, project.changes[fpath].alines, fpath)
  })
}

function shiftWithLiveEdits(project, fpath): void {
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

function shiftLineMarkers(lines, ranges): Array<string> {
  let shift = 0
  let pshift = 0
  let newLines = []
  // logger.log('shiftLineMarkers (lines, ranges)', lines, ranges)
  if (!ranges.length) return lines
  ranges.map(block => {
    shift = block.replaceLen - block.range.len
    const counted = []
    lines.map((line, i) => {
      if (line - pshift > block.range.line) lines[i] = Math.max(block.range.line, lines[i] + shift)
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

function clearLocalDiffs(project) {
  project.gitDiff = []
}

type TDiffReplace = {
  range: {
    line: number,
    len: number,
  },
  replaceLen: number,
}
function parseDiffFile(diffs): Array<TDiffReplace> {
  const lines = diffs.split('\n')
  const changes = []
  let sLine = 0
  let delLines = 0
  let insLines = 0
  for (const line of lines) {
    const start = line.substr(0, 3)
    if (['---', '+++', 'ind'].includes(start)) continue
    if (line[0] === '-') {
      delLines++
    } else if (line[0] === '+') {
      insLines++
    } else if (start === '@@ ') {
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
  console.log('unzip in ', extractDir)
  const filename = path.basename(zipFile)
  await shell.unzip(filename, extractDir)
  await shell.rmFile(zipFile)
}

// TODO: error handling of all these awaits
// TODO: it seems this crashes when closing the file (with save): `spawn C:\WINDOWS\system32\cmd.exe ENOENT`
async function sendAdhocDiffs(diffDir): Promise<void> {
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

  createEmpty(tmpProjectDiff)
  createEmpty(emptyFile)

  await git.command(gitDir, `git diff -b -U0 --no-color ${sha} >> ${tmpProjectDiff}`)

  return uploadDiffs({
    origin,
    diffDir,
    cSHA: sha,
    activePath: '', // TODO: add slide number, and connect to receive updates via socket
  })
}

async function refreshAdhocChanges({ origin, fpath }): Promise<void> {
  /* TODO: add caching (so we don't keep on asking for the same file when the user mad-clicks the same contributor) */

  logger.log('DIFFS: downloadDiffs (origin, fpath, user)', origin, fpath, CΩStore.user)
  PENDING_DIFFS[fpath] = true // this operation can take a while, so we don't want to start it several times per second
  /* @ts-ignore */
  if (lastDownloadDiff[origin] && new Date() - lastDownloadDiff[origin] < Config.SYNC_THRESHOLD) {
    return Promise.resolve()
  }

  lastDownloadDiff[origin] = new Date()

  return CΩAPI
    .getPPTSlideContrib({ origin, fpath })
    .then(res => res.data)
}

const CΩDiffs = {
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

export default CΩDiffs
