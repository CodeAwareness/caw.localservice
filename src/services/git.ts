import * as child from 'child_process'

import logger from '@/logger'

const isWindows = !!process.env.ProgramFiles

let labelIndex = 0

function gitExec(command: string, options = {}): Promise<string> {
  // TODO: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell;
  // also allows larger data to be returned, but we have to handle streaming data instead of a simple assignment)
  // however, git execution context may be affected...
  let data
  const label = `Git Command ${labelIndex++}`
  logger.time(label)
  try {
    logger.timeEnd(label)
    logger.log('\n')
    data = child.execSync(command, options)
    return Promise.resolve(data?.toString())
  } catch (err) {
    logger.timeEnd(label)
    logger.log('\n')
    if (data?.length) return Promise.resolve(data.toString())
    if (err.stderr?.toString()) {
      logger.log('\x1b[33m GIT: Shell failed \x1b[0m', data?.toString(), err?.toString())
      return Promise.reject(err.toString())
    } else if (err.stdout) {
      return Promise.resolve(err.stdout.toString()) // TODO: wtf is this...
    }
  }
}

function command(wsFolder: string, cmd: string): Promise<string> {
  const options = {
    env: Object.assign(process.env, { GIT_TERMINAL_PROMPT: '0' }),
    windowsHide: true,
    maxBuffer: 5242880, // TODO: ensure this is enough, or do spawn / streaming instead
    cwd: undefined,
    timeout: 10000
  }
  if (wsFolder) {
    /**
     * Windows tipsy notes:
     * You can have folder path reported by Windows / VSCode with either of the following patterns, depending on the planet alignment and the amount of alcohool you poured on your house plants:
     * 1. C:\Folder\Sub\fileName.ext
     * 2. c:\Folder\Sub\fileName.ext
     * 3. /c:/Folder/Sub/fileName.ext
     * 4. /C:/Folder/Sub/fileName.ext
     */
    options.cwd = isWindows && ['\\', '/'].includes(wsFolder[0]) ? wsFolder.substr(1).replace(/\//g, '\\') : wsFolder
  }

  logger.info('GIT:', cmd, 'in folder', options.cwd)
  // TODO: timeout or better handling; the patch command, for example, will ask for user input if no files are present in the cwd.
  return gitExec(cmd, options)
}

async function getRemotes(wsFolder: string): Promise<string | void> {
  return command(wsFolder, 'git remote -v')
    .then((stdout: string) => {
      const outLines = stdout.split('\n')
      if (!outLines.length) return logger.info('no output from git remote -v')
      const reOrigin = /[@/]+([^.]+.com[:/][^\s]+)?(\s)?/.exec(
        outLines.filter(line => /^origin/.test(line))[0],
      )
      if (!reOrigin) {
        return logger.info('GIT Not a cloud repository', wsFolder, stdout)
      }
      const origin = reOrigin[1].trim().replace(/.git$/, '')

      return origin
    })
}

export type TBranches = {
  branch: string,
  branches: Array<string>,
}

async function getBranches(wsFolder: string): Promise<TBranches> {
  return command(wsFolder, 'git branch --no-color')
    .then((stdout: string) => {
      const lines = stdout.split('\n')
      const branch = lines.filter(l => /^\*/.test(l))[0].substr(2)
      const branches = lines.map(line => line.replace('* ', '')).filter(a => a)
      return { branch, branches }
    })
}

const gitService = {
  getBranches,
  command,
  getRemotes,
}

export default gitService
