import os from 'os'

export const isWindows = os.platform() === 'win32' 

export function getRelativePath(root, fpath) {
  return fpath.substring(root.length + 1)
}

export function crossPlatform(fpath) {
  return fpath?.replace(/\\/g, '/')
}
