function splitLines(str: string): Array<string> {
  return str.split(/[\n\r]/).filter(a => a)
}

function getFirstLine(str: string): string {
  const nlPos = str.indexOf('\n')
  return str.substr(0, nlPos).trim()
}

const StringUtils = {
  getFirstLine,
  splitLines,
}

export default StringUtils
