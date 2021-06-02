const util = require('util')
const exec = require('child_process').exec

const logger = console

const isWindows = !!process.env.ProgramFiles

function gitExec(command, options = {}) {
  // TODO: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell; also allows larger data to be returned)
  return new Promise((resolve, reject) => {
    exec(command, options, function (error, stdout, stderr) {
      console.log(`GIT: command ${command} returned.`)
      // if (stderr) logger.log('git exec warning or error (command, error, stderr)', command, error, stderr)
      resolve(stdout)
    })
  })
}

function gitCommand(wsFolder, cmd) {
  const options = {
    env: Object.assign(process.env, { GIT_TERMINAL_PROMPT: '0' }),
    windowsHide: true,
    maxBuffer: 5242880, // TODO: ensure this is enough, or do spawn / streaming instead
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
  return gitExec(cmd, options)
}

async function gitRemotes(wsFolder) {
  return git.gitCommand(wsFolder, 'git remote -v')
    .then(stdout => {
      const outLines = stdout.split('\n')
      if (!outLines.length) return logger.info('no output from git remote -v')
      const reOrigin = /github.com[:/](.+)(\.git | )/.exec(
        outLines.filter(line => /^origin/.test(line))[0],
      )
      if (!reOrigin) {
        return logger.info('GIT Not a cloud repository', wsFolder, stdout)
      }
      const origin = reOrigin[1].trim().replace(/.git$/, '')

      return origin
    })
}

async function gitBranches(wsFolder) {
  return git.gitCommand(wsFolder, 'git branch --no-color')
    .then(stdout => {
      const lines = stdout.split('\n')
      const branch = lines.filter(l => /^\*/.test(l))[0].substr(2)
      const branches = lines.map(line => line.replace('* ', '')).filter(a => a)
      return { branch, branches }
    })
}

const git = {
  gitBranches,
  gitCommand,
  gitRemotes,
}

module.exports = git
