import * as crypto from 'crypto'

export function splitLines(str: string): Array<string> {
  return str.split(/[\n\r]/).filter(a => a)
}

export function getFirstLine(str: string): string {
  const nlPos = str.indexOf('\n')
  return str.substr(0, nlPos).trim()
}

export function generateUUID(len) {
  return (crypto as any) // until Crypto types are updated
    .randomBytes(Math.ceil(len / 2))
    .toString('hex') // convert to hexadecimal format
    .slice(0, len) // return required number of characters
}

const StringUtils = {
  generateUUID,
  getFirstLine,
  splitLines,
}

export default StringUtils
