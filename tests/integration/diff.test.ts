import * as path from 'path'
import nock from 'nock'
import stream from 'stream'

import * as helpers from '../utils/helpers'

import config from '@/config/config'
import CAWAPI, { API_REPO_COMMITS } from '@/services/api'
import CAWDiffs from '@/services/diffs'
import CAWStore from '@/services/store'
import RepoController from '@/controllers/repo.controller'

import { serverDataContribReadme } from '../fixtures/contrib-readme'
import { README_MOCK } from '../fixtures/readme-mock'

jest.mock('@/logger', () => ({
  init: () => {},
  log: () => {},
  info: () => {},
  debug: () => {},
}))
jest.mock('tar')

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

describe('Code Awareness diffs', () => {
  describe('Sending diffs', () => {
    test('sending commit log should return the common SHA', async () => {
      // helpers.mockGitForSendDiffs()
      helpers.makeTokens({ store: true })
      CAWAPI.clearAuth()
      const cSHA = 'd21b8ff5fc534fda0135751728d167cbf4abae43'
      nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
        .post(CAWAPI.API_REPO_COMMITS, () => true)
        .reply(200, { cSHA })
      nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
        .post(CAWAPI.API_REPO_CONTRIB, () => true)
        .reply(200, {  })
      nock(config.API_URL, { reqheaders: { authorization: `Bearer ${CAWStore.tokens.access.token}` } })
        .get(CAWAPI.API_REPO_COMMON_SHA, () => true)
        .query(true) // allows any query string
        .reply(200, { sha: cSHA })
      const apiPostSpy = jest.spyOn(CAWAPI.axiosAPI, 'post')
      const apiGetSpy = jest.spyOn(CAWAPI.axiosAPI, 'post')

      const cid = '123'
      const tmpDir = helpers.prepareTmp(cid)
      const project = await helpers.prepareProject(cid)
      // TEST
      try {
        await CAWDiffs.sendCommitLog(project)
      } catch (err) {
        console.error(err)
      }

      expect(project.head).toEqual('a9009b639bce9ff05a1cced7859b41687054bd5c')
      expect(project.cSHA).toEqual(cSHA)
      expect(apiPostSpy).toHaveBeenCalledTimes(2)
      expect(apiGetSpy).toHaveBeenCalledTimes(2)
    })
  })
})
