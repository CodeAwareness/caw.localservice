import * as path from 'path'
import * as util from 'util'
import * as child from 'child_process'
import * as fs from 'fs/promises'
import PowerShell from 'node-powershell'

const exec = util.promisify(child.exec)
const logger = console

const isWindows = !!process.env.ProgramFiles

async function cmd(command: string, dir: string = undefined): Promise<string> {
  // TODO: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell)
  const options = {
    windowsHide: true,
    maxBuffer: 5242880, // TODO: ensure this is enough, or do spawn / streaming instead
    cwd: undefined,
  }
  if (dir) {
    options.cwd = isWindows && ['\\', '/'].includes(dir[0]) ? dir.substr(1).replace(/\//g, '\\') : dir
    console.log(`executing '${command}' in folder`, options.cwd)
  }
  const { stdout, stderr } = await exec(command, options)
  if (stderr) logger.log('shell exec warning or error', command, stderr)
  return stdout
}

// TODO: SECURITY: sanitize input; attack vector: specially crafted file name can be maliciously added to the repo (double check)
const copyFile = async (source: string, destDir: string): Promise<string> => {
  const dest = path.join(destDir, 'repo.zip')
  const command = `cp "${source}" "${dest}"`
  if (isWindows) {
    const ps = new PowerShell({ executionPolicy: 'Bypass', noProfile: true })
    ps.addCommand(command)
    await ps.invoke()
  } else {
    await cmd(command)
  }
  return dest
}

const unzip = async (filename: string, dir: string): Promise<string> => {
  logger.log('will unzip using shell cmd', filename, dir)
  if (isWindows) {
    // TODO: make sure we install at Peer8 folder or somehow get the user chosen folder from the installer
    return cmd(`tar.exe -xf ${filename}`, dir)
  } else {
    return cmd(`unzip ${filename}`, dir)
  }
}

const zipToPPTX = async (fpath: string, dir: string): Promise<string> => {
  logger.log('will zip using shell cmd', fpath, dir)
  if (isWindows) {
    return cmd(`tar.exe --exclude .git -caf ${fpath} *.*`, dir)
  } else {
    return cmd(`zip -r ${fpath} .`, dir)
  }
}

const rmFile = async (fpath: string): Promise<void> => {
  return fs.unlink(fpath)
}

const Shell = {
  copyFile,
  rmFile,
  unzip,
  zipToPPTX,
}

export default Shell
