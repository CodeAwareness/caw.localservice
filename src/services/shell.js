const path = require('path')
const fs = require('fs/promises')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const PowerShell = require('node-powershell')

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
  if (stderr) logger.log('shell exec warning or error', command, stderr)
  return stdout
}

// TODO: SECURITY: sanitize input; attack vector: specially crafted file name can be maliciously added to the repo.
const copyFile: any = async (source, destDir) => {
  const dest = path.join(destDir, 'repo.zip')
  const command = `cp -r "${source}" "${dest}"`
  if (isWindows) {
    const ps = new PowerShell({ executionPolicy: 'Bypass', noProfile: true })
    ps.addCommand(command)
    await ps.invoke()
  } else {
    await cmd(command)
  }
  return dest
}

const unzip: any = async (filename, dir) => {
  logger.log('will unzip using shell cmd', filename, dir)
  if (isWindows) {
    // TODO: make sure we install at Peer8 folder or somehow get the user chosen folder from the installer
    return cmd(`tar.exe -xf ${filename}`, dir)
  } else {
    return cmd(`unzip ${filename}`, dir)
  }
}

const zipToPPTX: any = async (fpath, dir) => {
  logger.log('will zip using shell cmd', fpath, dir)
  if (isWindows) {
    return cmd(`tar.exe --exclude .git -caf ${fpath} *.*`, dir)
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
