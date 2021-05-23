const path = require('path')
const exec = require('child_process')

const { logger } = require('@/logger')
const catchAsync = require('@/utils/catchAsync')

const isWindows = !!process.env.ProgramFiles

function cmd(command, dir) {
  // TODO: maybe use spawn instead of exec (more efficient since it doesn't spin up any shell)
  const options = {
    windowsHide: true,
    maxBuffer: 5242880, // TODO: ensure this is enough, or do spawn / streaming instead
  }
  if (dir) {
    options.cwd = isWindows && ['\\', '/'].includes(dir[0]) ? dir.substr(1).replace(/\//g, '\\') : dir
  }
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      // if (stderr) reject(stderr, error) // TODO: find a better solution to actually reject when needed;
      if (stderr) logger.log('shell exec warning or error', command, error, stderr)
      resolve(stdout)
    })
  })
}

const copyFile: any = catchAsync(async (source, dest) => {
  let command
  if (isWindows) {
    logger.info('FS: Windows system, trying xcopy source dest')
    command = `xcopy /j /o /q ${source} ${dest}`
  } else {
    command = `cp -r ${source} ${dest}`
  }
  return cmd(command)
})

const unzip: any = catchAsync(async (fpath, dir) => {
  logger.log('will unzip using shell cmd', fpath, dir)
  if (isWindows) {
    const unzip = path.join(process.env.ProgramFiles, 'Peer8', '7za.exe')
    return cmd(`${unzip} e ${fpath}`, dir)
  } else {
    return cmd(`unzip ${fpath}`, dir)
  }
})

const shell = {
  copyFile,
  unzip,
}

module.exports = shell
