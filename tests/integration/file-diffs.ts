import fs from 'node:fs/promises'
import * as path from 'path'
import nock from 'nock'

import * as helpers from '../utils/helpers'

import config from '@/config/config'
import CAWAPI from '@/services/api'
import CAWStore from '@/services/store'
import CAWDiffs from '@/services/diffs'
import repoController from '@/controllers/repo.controller'

import treeMock from '../fixtures/tree'
import usersMock from '../fixtures/users'
import contribMock from '../fixtures/contrib-file'
import { doesNotReject } from 'node:assert'

let hanaDiffs, unoDiffs
let readmeMark, readmeHana, readmeUno
const promises = []

promises.push(fs.readFile('./tests/fixtures/hana.diffs', { encoding: 'utf8' })
  .then(content => (hanaDiffs = content)))
promises.push(fs.readFile('./tests/fixtures/uno.diffs', { encoding: 'utf8' })
  .then(content => (unoDiffs = content)))
promises.push(fs.readFile('./tests/fixtures/README.mark.md', { encoding: 'utf8' })
  .then(content => (readmeMark = content)))
promises.push(fs.readFile('./tests/fixtures/README.uno.md', { encoding: 'utf8' })
  .then(content => (readmeUno = content)))
promises.push(fs.readFile('./tests/fixtures/README.hana.md', { encoding: 'utf8' })
  .then(content => (readmeHana = content)))

const uidHana = '646d4bcb4177c25ce07eba16'
const uidUno = '646d4bef4177c25ce07eba1d'
const cid = 'test-cid-01'

jest.mock('@/logger', () => ({
  init: () => {},
  log: () => {},
  info: () => {},
  debug: () => {},
}))
jest.mock('tar')

const mockEmitter = {
  emit: () => {
    // nothing
  },
}

beforeAll(async () => Promise.all(promises))

beforeEach(() => {
  jest.clearAllMocks()
  nock.cleanAll()
  nock.disableNetConnect()
  CAWStore.reset()
  helpers.resetMocks()
})

afterEach(() => {
  if (!nock.isDone()) {
    console.error(new Error('Not all nock interceptors were used!'))
    console.log('Unresolved mocks:', nock.pendingMocks())
    nock.cleanAll()
  }
})

describe('Download changes', () => {
  test('downloading changes', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)

    const contribBody = { users: usersMock, file: contribMock, tree: treeMock }
    const project = { root: '/home/mark/projects/codeawareness', origin: 'https://github.com/CodeAwareness/mongo-alias' }
    const uriOrigin = encodeURIComponent(project.origin)
    const fpath = 'src/mongo.service.ts'

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_CONTRIB}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`, () => true)
      .reply(200, contribBody)

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_DIFF_FILE}?origin=${uriOrigin}&fpath=diffs/${uidHana}/CodeAwareness/mongo-alias/src/mongo.service.ts`, () => true)
      .reply(200, hanaDiffs)

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_DIFF_FILE}?origin=${uriOrigin}&fpath=diffs/${uidUno}/CodeAwareness/mongo-alias/src/mongo.service.ts`, () => true)
      .reply(200, unoDiffs)

    await CAWDiffs.downloadChanges(project, fpath, cid)

    const tmpDir = CAWStore.uTmpDir[cid]
    const downloadRoot = path.join(tmpDir, config.EXTRACT_DOWNLOAD_DIR)

    let denied = false
    try {
      await fs.access(path.join(downloadRoot, `${uidHana}.diff`))
      await fs.access(path.join(downloadRoot, `${uidUno}.diff`))
    } catch (err) {
      console.log('ERROR ACCESS')
      console.dir(err)
      denied = true
    }

    // TEST
    expect(denied).toBe(false)
  })

  test('apply diffs', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)
    const tmpDir = CAWStore.uTmpDir[cid]
    const downloadRoot = path.join(tmpDir, config.EXTRACT_DOWNLOAD_DIR)
    await fs.writeFile(path.join(downloadRoot, `${uidHana}.diff`), hanaDiffs)
    await fs.writeFile(path.join(downloadRoot, `${uidUno}.diff`), unoDiffs)

    const fpath = 'src/mongo.service.ts'
    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/mongo-alias'),
      origin: 'https://github.com/CodeAwareness/mongo-alias',
      changes: {}
    }
    project.changes[fpath] = { users: usersMock, file: contribMock }
    const doc = path.join(__dirname, '../fixtures/src/mongo.service.ts')

    await CAWDiffs.applyDiffs({ doc, fpath, cid })

    // TEST
    expect(project.changes[fpath].file.changes[uidHana].diffs[0]).toEqual({ range: { line: 0, len: 0, content: [] }, replaceLen: 0 })
    expect(project.changes[fpath].file.changes[uidUno].diffs[0]).toEqual({ range: { line: 10, len: 1, content: [] }, replaceLen: 0 })
    expect(project.changes[fpath].file.changes[uidUno].diffs[1]).toEqual({ range: { line: 30, len: 1, content: ['    console.debug('] }, replaceLen: 1 })
    expect(project.changes[fpath].file.changes[uidUno].diffs[15]).toEqual({
      range: {
        line: 298,
        len: 3,
        content: [
          "      if (debug) console.log('INSERT MANY', '\\x1b[33m')",
          '      if (debug) console.dir(mongoFilter, { depth: null })',
          "      if (debug) console.log('\\x1b[0m')"
        ]
      },
      replaceLen: 3,
    })
    expect(project.changes[fpath].file.changes[uidUno].diffs[18]).toEqual({
      range: {
        line: 326,
        len: 1,
        content: [
          "      if (debug) console.log('UPDATE MANY', '\\x1b[33m', mongoFilter, '\\x1b[0m\\n', '\\x1b[33m', mongoUpdate, options || '', '\\x1b[0m')",
        ]
      },
      replaceLen: 1,
    })
    expect(project.changes[fpath].alines).toEqual([
      0, 10, 30, 44, 45, 60, 61,
      65, 75, 182, 241, 250, 254, 260,
      266, 272, 279, 291, 298, 299, 300,
      308, 317, 326
    ])
  })
})
