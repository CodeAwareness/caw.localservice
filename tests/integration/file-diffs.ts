import fs from 'node:fs/promises'
import * as path from 'path'
import nock from 'nock'

import * as helpers from '../utils/helpers'

import config from '@/config/config'
import CAWAPI from '@/services/api'
import CAWStore from '@/services/store'
import CAWDiffs from '@/services/diffs'
import repoController from '@/controllers/repo.controller'
import shell from '@/services/shell'

import REPO_CHANGES from '../fixtures/repo-changes.res'
// TODO:
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
  time: () => {},
  timeEnd: () => {},
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

    const project = { root: '/home/mark/projects/codeawareness', origin: 'https://github.com/CodeAwareness/mongo-alias' }
    const uriOrigin = encodeURIComponent(project.origin)
    const fpath = 'src/mongo.service.ts'
    const cpPath = shell.crossPlatform(fpath)
    const docFile = path.join(CAWStore.uTmpDir[cid], config.EXTRACT_LOCAL_DIR, 'active-doc')

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_CHANGES}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`, () => true)
      .reply(200, REPO_CHANGES)

    const context = { project, cpPath, fpath, docFile, cid }
    const res = await CAWDiffs.downloadChanges(context) as any

    // TEST
    expect(res?.agg).toEqual({ e154e445d3f10e9ee95436f43a6d1bd2f3783220: [3, 4, 9, 10, 19] })
    expect(res?.users).toHaveLength(2)
    expect(res?.file.file).toEqual('README.md')
    expect(res?.tree).toHaveLength(2)
  })

  test('apply diffs', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)
    const tmpDir = CAWStore.uTmpDir[cid]
    const downloadRoot = path.join(tmpDir, config.EXTRACT_DOWNLOAD_DIR)
    const fpath = 'src/mongo.service.ts'
    const cpPath = shell.crossPlatform(fpath)
    const docFile = path.join(CAWStore.uTmpDir[cid], config.EXTRACT_LOCAL_DIR, 'active-doc')

    await fs.writeFile(path.join(downloadRoot, `${uidHana}.diff`), hanaDiffs)
    await fs.writeFile(path.join(downloadRoot, `${uidUno}.diff`), unoDiffs)
    await fs.copyFile(path.join(__dirname, '../fixtures/mongo-alias/src/mongo.service.ts'), docFile)

    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/mongo-alias'),
      origin: 'https://github.com/CodeAwareness/mongo-alias',
      agg: {
        ec989dc1fea23ef69ec37ba3a556d04f117cf835: [3, 9, 11],
        e154e445d3f10e9ee95436f43a6d1bd2f3783220: [4, 9, 20],
      },
    }
    const context = { project, cpPath, fpath, docFile, cid }

    const res = await CAWDiffs.applyDiffs(context)

    expect(res).toEqual([3, 4, 9, 10, 19])
  })

  test('refresh changes', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)
    const fpath = 'src/mongo.service.ts'
    const uriOrigin = 'https://github.com/CodeAwareness/mongo-alias'

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_CHANGES}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`, () => true)
      .reply(200, REPO_CHANGES)

    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/mongo-alias'),
      origin: uriOrigin,
      cSHA: 'e154e445d3f10e9ee95436f43a6d1bd2f3783220',
    }
    const doc = await fs.readFile(path.join(__dirname, '../fixtures/src/mongo.service.ts'), { encoding: 'utf-8' })

    const res = await CAWDiffs.refreshChanges(project, fpath, doc, cid) as any

    expect(res.cSHA).toEqual(project.cSHA)
    expect(res.origin).toEqual(project.origin)
    expect(res.root).toEqual(project.root)
    expect(res.hl).toEqual([3, 4, 9, 18])
  })
})
