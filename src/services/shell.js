const path = require('path')
const fs = require('fs/promises')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const logger = console

const isWindows = !!process.env.ProgramFiles

async function cmd(command, dir) {
  // TODO: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell)
  const options = {
    windowsHide: true,
    maxBuffer: 5242880, // TODO: ensure this is enough, or do spawn / streaming instead
  }
  if (dir) {
    options.cwd = isWindows && ['\\', '/'].includes(dir[0]) ? dir.substr(1).replace(/\//g, '\\') : dir
    console.log(`executing '${command}' in folder`, options.cwd)
  }
  const { stdout, stderr } = await exec(command, options)
  if (stderr) logger.log('shell exec warning or error', command, error, stderr)
  return stdout
}

// TODO: SECURITY: sanitize input; attack vector: specially crafted file name can be maliciously added to the repo.
const copyFile: any = async (source, destDir) => {
  const dest = path.join(destDir, 'repo.zip')
  if (isWindows) {
    logger.info('FS: Windows system, trying xcopy source dest')
    const filename = path.basename(source)
    await cmd(`xcopy "${source}" "${destDir}"`)
    await cmd(`Ren "${filename}" repo.zip`, destDir)
  } else {
    await cmd(`cp -r "${source}" "${dest}"`)
  }
  return dest
}

const unzip: any = async (filename, dir) => {
  logger.log('will unzip using shell cmd', filename, dir)
  if (isWindows) {
    // TODO: make sure we install at Peer8 folder or somehow get the user chosen folder from the installer
    // const cmdPath = path.join(process.env.ProgramFiles, 'Peer8', '7za.exe')
    const cmdPath = path.join('C:\\Users\\maria\\Downloads\\7zip', '7za.exe')
    return cmd(`"${cmdPath}" e ${filename}`, dir)
  } else {
    return cmd(`unzip ${filename}`, dir)
  }
}

const zipToPPTX: any = async (fpath, dir) => {
  logger.log('will zip using shell cmd', fpath, dir)
  if (isWindows) {
    // TODO: make sure we install at Peer8 folder or somehow get the user chosen folder from the installer
    const zip = path.join(process.env.ProgramFiles, 'Peer8', '7za.exe')
    return cmd(`${zip} a -r ${fpath}`, dir)
  } else {
    return cmd(`zip -r ${fpath} .`, dir)
  }
}

const rmFile: any = async (fpath) => {
  return fs.unlink(fpath)
}

const shell = {
  copyFile,
  rmFile,
  unzip,
  zipToPPTX,
}

module.exports = shell
