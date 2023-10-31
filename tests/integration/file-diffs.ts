import fs from 'node:fs/promises'
import * as path from 'path'
import nock from 'nock'
import * as _ from 'lodash'

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
  CAWDiffs.reset()
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

    const project = { root: '/home/mark/projects/codeawareness', origin: 'https://github.com/CodeAwareness/mongo-alias', dl: {} }
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
    expect(res?.dl[fpath].agg).toEqual({
      ec989dc1fea23ef69ec37ba3a556d04f117cf835: [1, 3, 7],
      '414e625fd283ac36e86ac8c972e698496b8e2c6d': [2, 4, 5],
    })
    expect(res?.dl[fpath].users).toHaveLength(3)
    expect(res?.dl[fpath].file.file).toEqual('package.json')
    expect(res?.dl[fpath].tree).toHaveLength(2)
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
      cSHA: 'ec989dc1fea23ef69ec37ba3a556d04f117cf835',
    }
    const doc = await fs.readFile(path.join(__dirname, '../fixtures/src/mongo.service.ts'), { encoding: 'utf-8' })

    const res = await CAWDiffs.refreshChanges(project, fpath, doc, cid) as any

    expect(res.cSHA).toEqual(project.cSHA)
    expect(res.origin).toEqual(project.origin)
    expect(res.root).toEqual(project.root)
    expect(res.hl).toEqual([1, 2, 3, 5])
  })

  test('refresh changes uno', async () => {
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
      cSHA: 'ec989dc1fea23ef69ec37ba3a556d04f117cf835',
    }
    const doc = await fs.readFile(path.join(__dirname, '../fixtures/src/mongo.service.uno.ts'), { encoding: 'utf-8' })

    const res = await CAWDiffs.refreshChanges(project, fpath, doc, cid) as any

    expect(res.cSHA).toEqual(project.cSHA)
    expect(res.origin).toEqual(project.origin)
    expect(res.root).toEqual(project.root)
    expect(res.hl).toEqual([1, 2, 3, 4, 5, 7])
  })
})

describe('Walking the SHA', () => {
  test('should correctly aggregate diffs based on two different SHA values', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)

    const fpath = 'test.md'
    const uriOrigin = 'https://github.com/CodeAwareness/raw-diffs'

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_CHANGES}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`, () => true)
      .reply(200, {
        agg: {
          '4c6a9aca464d85d16d53199a338792ad09b4996f': [1, 3, 7],
          d62e969db1d8bd808040846a083c39c012c915d5: [2, 4],
        }
      })

    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/raw-diffs'),
      origin: uriOrigin,
      cSHA: '4c6a9aca464d85d16d53199a338792ad09b4996f',
    }
    const doc = await fs.readFile(path.join(__dirname, '../fixtures/raw-diffs-test-b2.md'), { encoding: 'utf-8' })

    const res = await CAWDiffs.refreshChanges(project, fpath, doc, cid) as any

    expect(res.cSHA).toEqual(project.cSHA)
    expect(res.origin).toEqual(project.origin)
    expect(res.root).toEqual(project.root)
    expect(res.hl).toEqual([1, 2, 3, 7])
  })

  test('should correctly aggregate diffs based on the common (older) SHA value', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)

    const fpath = 'test.md'
    const uriOrigin = 'https://github.com/CodeAwareness/raw-diffs'

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(`${CAWAPI.API_REPO_CHANGES}?origin=${uriOrigin}&fpath=${fpath}&clientId=${cid}`, () => true)
      .reply(200, {
        agg: {
          '4c6a9aca464d85d16d53199a338792ad09b4996f': [1, 3, 7, 9],
        }
      })

    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/raw-diffs'),
      origin: uriOrigin,
      cSHA: '4c6a9aca464d85d16d53199a338792ad09b4996f',
    }
    const doc = await fs.readFile(path.join(__dirname, '../fixtures/raw-diffs-test-c.md'), { encoding: 'utf-8' })

    const res = await CAWDiffs.refreshChanges(project, fpath, doc, cid) as any

    expect(res.cSHA).toEqual(project.cSHA)
    expect(res.origin).toEqual(project.origin)
    expect(res.root).toEqual(project.root)
    expect(res.hl).toEqual([1, 2, 3, 4, 5, 6, 10, 12])
  })
})

describe('Subsequent requests', () => {
  test('should download changes on first request, provide from cache on second request', async () => {
    helpers.makeTokens({ store: true })
    CAWAPI.clearAuth()
    await repoController.getTmpDir.bind(mockEmitter)(cid)

    const fpath1 = 'test1.md'
    const fpath2 = 'test2.md'
    const uriOrigin = 'https://github.com/CodeAwareness/raw-diffs'
    const userOne = { _id: 123, name: 'User One' }
    const userTwo = { _id: 234, name: 'User Two' }
    const userThree = { _id: 423, name: 'User Three' }
    const userFour = { _id: 434, name: 'User Four' }

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(CAWAPI.API_REPO_CHANGES, () => true)
      .query({ fpath: fpath1, clientId: cid, origin: uriOrigin })
      .reply(200, {
        users: [userOne, userTwo],
        tree: ['test1.md', 'test2.md'],
        file: { file: fpath1, changes: {} },
        agg: {
          '880b67f2f587d7af5c3037478de7c46e52c71ebd': [5, 9, 13],
        }
      })

    nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
      .get(CAWAPI.API_REPO_CHANGES, () => true)
      .query({ fpath: fpath2, clientId: cid, origin: uriOrigin })
      .reply(200, {
        users: [userThree, userFour],
        tree: ['test1.md', 'test2.md'],
        file: { file: fpath2, changes: {} },
        agg: {
          '880b67f2f587d7af5c3037478de7c46e52c71ebd': [1, 3, 7],
        }
      })

    const project = CAWStore.activeProjects[cid] = {
      root: path.join(__dirname, '../fixtures/raw-diffs'),
      origin: uriOrigin,
      cSHA: '880b67f2f587d7af5c3037478de7c46e52c71ebd',
    }
    const doc1 = await fs.readFile(path.join(__dirname, '../fixtures/raw-diffs-test-b1.md'), { encoding: 'utf-8' })
    const doc2 = await fs.readFile(path.join(__dirname, '../fixtures/raw-diffs-test-b2.md'), { encoding: 'utf-8' })

    const res1 = _.cloneDeep(await CAWDiffs.refreshChanges(project, fpath1, doc1, cid))
    const res2 = _.cloneDeep(await CAWDiffs.refreshChanges(project, fpath2, doc2, cid))
    const res3 = _.cloneDeep(await CAWDiffs.refreshChanges(project, fpath1, doc1, cid))
    const res4 = _.cloneDeep(await CAWDiffs.refreshChanges(project, fpath2, doc2, cid))

    expect(res1.users).toEqual([userOne, userTwo])
    expect(res1.file.file).toEqual(fpath1)
    expect(res1.tree).toEqual(['test1.md', 'test2.md'])

    expect(res2.users).toEqual([userThree, userFour])
    expect(res2.file.file).toEqual(fpath2)
    expect(res2.tree).toEqual(['test1.md', 'test2.md'])

    expect(res3.users).toEqual([userOne, userTwo])
    expect(res3.file.file).toEqual(fpath1)
    expect(res3.tree).toEqual(['test1.md', 'test2.md'])

    expect(res4.users).toEqual([userThree, userFour])
    expect(res4.file.file).toEqual(fpath2)
    expect(res4.tree).toEqual(['test1.md', 'test2.md'])
  })
})
