/* @flow */

const path = require('path')
const mkdirp = require('mkdirp')
const { writeFile } = require('fs/promises')
const chokidar = require('chokidar')

const api = require('@/services/api')
const git = require('@/services/git')
const shell = require('@/services/shell')
const { Peer8Store } = require('@/services/peer8.store')
const catchAsync = require('@/utils/catchAsync')
const crypto = require('crypto')

const splitIntoGroups: any = catchAsync(async (req, res) => {
  const tmpDir = Peer8Store.tmpDir
  const { fpath, groups } = req.body
  const extractDir = path.join(tmpDir, crypto.randomUUID())
  mkdirp.sync(extractDir)
  const zipFile = await copyToWorkspace({ fpath, extractDir })
  await shell.copyFile(fpath, zipFile)
  const { origin, links } = await api.shareFile({ zipFile, groups })
  await unzip({ zipFile, extractDir })
  await initGit({ extractDir, origin })
  monitorFile({ extractDir, fpath })
  /**
   * links = [{ origin, invitationLinks }, {...}, ...]
   */
  res.send(links)
  // TODO: await shell.unzip(path.basename(zipFile), extractDir)
})

async function copyToWorkspace({ fpath, extractDir }) {
  const filename = path.basename(fpath)
  const zipFile = path.join(extractDir, `${filename}.zip`)
  await shell.copyFile(fpath, zipFile)
  return zipFile
}

async function unzip({ zipFile, extractDir }) {
  console.log('unzip in ', extractDir)
  const filename = path.basename(zipFile)
  await shell.unzip(filename, extractDir)
  await shell.rmFile(zipFile)
}

async function initGit({ extractDir, origin }) {
  await git.gitCommand(extractDir, 'git init')
  await git.gitCommand(extractDir, 'git add .')
  await git.gitCommand(extractDir, `git remote add origin ${origin}`)
  await git.gitCommand(extractDir, 'git commit -am "initial commit"')
}

async function updateGit(extractDir) {
  await git.gitCommand(extractDir, 'git add .')
  await git.gitCommand(extractDir, 'git commit -am "updated"')
}

function monitorFile({ fpath, extractDir }) {
  chokidar.watch(fpath)
    .on('change', () => {
      refreshDiffs({ fpath, extractDir })
    })
}

// TODO: when closing the PPT:
function unmonitorFile(fpath) {
  chokidar.unwatch(fpath)
}

async function refreshDiffs({ extractDir, fpath }) {
  console.log('File has been saved, refreshing diffs.')
  await copyToWorkspace({ extractDir, fpath })
  await updateGit(extractDir)
  // TODO: regular update as repo
}

const receiveShared: any = catchAsync(async (req, res) => {
  const { origin, folder } = req.body
  const tmpDir = Peer8Store.tmpDir
  const extractDir = path.join(tmpDir, crypto.randomUUID())
  mkdirp.sync(extractDir)

  let fpath
  return api.receiveShared(origin)
    .then(({ data, headers }) => {
      const filename = headers['Content-Disposition']?.split('filename=')[1]
      fpath = path.join(folder, filename)
      return writeFile(fpath, data)
    })
    .then(() => {
      copyToWorkspace({ fpath, extractDir })
    })
    .then(zipFile => {
      unzip({ zipFile, extractDir })
      initGit({ extractDir, origin })
    })
    .then(() =>  {
      monitorFile({ fpath, extractDir })
    })
})

const pptContributors: any = catchAsync(async (req, res) => {
  const { slideIndex } = req.body
  // TODO: retrieve diffs for this Slide
})

module.exports = {
  receiveShared,
  pptContributors,
  splitIntoGroups,
}
