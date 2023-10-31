import { getProjectFromPath } from '@/services/repo'
import CAWContext from '@/services/context'

type TSelection = {
  active: { line: number, character: number }
  anchor: { line: number, character: number }
  end: { line: number, character: number }
  start: { line: number, character: number }
}

type TSelLinesReq = {
  fpath: string
  selections: TSelection[]
  context?: string[]
  op: 'add' | 'del',
  cid: string
  caw: string
}

function selectLines(data: TSelLinesReq) {
  console.log('SELECTED LINES', data)
  const { origin, activePath } = getProjectFromPath(data.fpath)
  const { selections } = data
  const selData = { origin, activePath, selections }
  // TODO: get the active context items for the selection
}

function applyContext(data: TSelLinesReq) {
  const { origin, activePath } = getProjectFromPath(data.fpath)
  const { selections, op } = data
  const context = typeof data.context === 'string' ? [data.context] : data.context
  const newContext = { origin, activePath, selections, context, op }
  return CAWContext.applyContext(newContext)
    .then(data => this.emit('res:context:apply', data))
}

const contextController = {
  applyContext,
  selectLines,
}

export default contextController
