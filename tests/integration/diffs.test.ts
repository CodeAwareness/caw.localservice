import * as path from 'path'
import nock from 'nock'
import stream from 'stream'

import { makeTokens, mockGitForDownloadDiffs, mockGitForSendDiffs, resetMocks } from '../utils/helpers'

import CΩAPI from '../../src/services/api'
import CΩDiffs from '../../src/services/diffs'
import { CΩStore } from '../../src/services/store'

import { serverDataContribReadme } from '../fixtures/contrib-readme'
import { README_MOCK } from '../fixtures/readme-mock'

jest.mock('../../src/lib/logger')
jest.mock('tar')

beforeEach(() => {
  jest.clearAllMocks()
  nock.cleanAll()
  nock.disableNetConnect()
  CΩStore.reset()
  resetMocks()
})

afterEach(() => {
  if (!nock.isDone()) {
    console.error(new Error('Not all nock interceptors were used!'))
    console.log('Unresolved mocks:', nock.pendingMocks())
    nock.cleanAll()
  }
})

describe('CΩDiffs', () => {
  describe('Sending diffs', () => {
    /*
    test('sending commit log should return the common SHA', async () => {
      mockGitForSendDiffs()
      makeTokens({ store: true })
      const cΩ = '123'
      CΩAPI.clearAuth()
      nock(CΩAPI.API_URL, { reqheaders: { authorization: `Bearer ${CΩStore.tokens.access.token}` } })
        .post(CΩAPI.API_REPO_COMMITS, () => true)
        .reply(200, { cΩ, cSHA: 'TEST_CSHA' })
      const apiSpy = jest.spyOn(CΩAPI, 'sendCommitLog')

      await CΩSCM.addProject(path.join(__dirname, '../fixtures/atom-svelte-transpiler'))
      CΩStore.activeProjects = {}
      CΩStore.activeProjects[cΩ] = CΩStore.projects[0]
      const activeProject = CΩStore.activeProjects[cΩ]

      // TEST
      await CΩDiffs.sendCommitLog(activeProject, cΩ)

      expect(activeProject.head).toEqual('TEST_HEAD')
      expect(activeProject.cSHA).toEqual('TEST_CSHA')
      expect(apiSpy).toHaveBeenCalledTimes(1)
    })
    */

    /*
    test('trying to send commit log when HEAD has not changed should only fetch the latest common SHA, without sending the same commit list again', async () => {
      mockGitForSendDiffs()
      makeTokens({ store: true })
      CΩAPI.clearAuth()
      const cΩ = '123'
      const clogSpy = jest.spyOn(CΩAPI, 'sendCommitLog')
      const cshaSpy = jest.spyOn(CΩAPI, 'findCommonSHA')
      nock(CΩAPI.API_URL, { reqheaders: { authorization: `Bearer ${CΩStore.tokens.access.token}` } })
        .get(CΩAPI.API_REPO_COMMON_SHA)
        .query({ origin: 'github.com/cΩ/test' })
        .reply(200, { sha: 'TEST_CSHA' })

      await CΩSCM.addProject(path.join(__dirname, '../fixtures/atom-svelte-transpiler'))
      CΩStore.activeProjects = {}
      CΩStore.activeProjects[cΩ] = CΩStore.projects[0]
      const { activeProject } = CΩStore
      activeProject.head = 'TEST_HEAD'

      // TEST
      const csha = await CΩDiffs.sendCommitLog(activeProject)

      expect(csha).toEqual('TEST_CSHA')
      expect(clogSpy).not.toHaveBeenCalled()
      expect(cshaSpy).toHaveBeenCalledTimes(1)
    })
    */

    /*
    test('CΩDiffs.sendDiffs should complete successfully', async () => {
      mockGitForSendDiffs()
      makeTokens({ store: true })
      CΩWorkspace.init()
      const cΩ = '123'
      const pipelineSpy = jest.spyOn(stream, 'pipeline').mockImplementation((src, content, dest, cb) => cb())
      nock(CΩAPI.API_URL, { reqheaders: { authorization: `Bearer ${CΩStore.tokens.access.token}` } })
        .get(CΩAPI.API_REPO_COMMON_SHA)
        .query({ origin: 'github.com/cΩ/test' })
        .reply(200, { sha: 'TEST_CSHA' })
      nock(CΩAPI.API_URL, { reqheaders: { authorization: `Bearer ${CΩStore.tokens.access.token}` } })
        .post(CΩAPI.API_REPO_CONTRIB, () => true)
        .reply(200)

      await CΩSCM.addProject(path.join(__dirname, '../fixtures/atom-svelte-transpiler'))
      CΩStore.activeProjects = {}
      CΩStore.activeProjects[cΩ] = CΩStore.projects[0]
      const { activeProject } = CΩStore
      activeProject.head = 'TEST_HEAD'

      // TEST
      await CΩDiffs.sendDiffs(activeProject)

      expect(pipelineSpy).toHaveBeenCalledTimes(1)
    })
    */
  })

  describe('Live editing adjusting markers', () => {
    /*
    test('should sink lines if user types ENTER to create a new line', async () => {
      const vscodeChanges = {
        contentChanges: [{
          range: { _start: { _line:  6, _character: 27 }, _end: { _line:  6, _character: 27 } },
          text: '\r  ',
        }],
      }
      const changes = await setupChanges(vscodeChanges)

      // TEST
      CΩWorkspace.refreshLines(vscodeChanges)

      expect(changes.alines.sha1).toEqual([1, 2, 5, 6, 7, 9, 15, 36])
    })

    test('should not change anything if the user just changes a line', async () => {
      const vscodeChanges = {
        contentChanges: [{
          range: { _start: { _line:  4, _character: 27 }, _end: { _line:  4, _character: 30 } },
          text: 'replacement',
        }],
      }
      const changes = await setupChanges(vscodeChanges)

      // TEST
      CΩWorkspace.refreshLines(vscodeChanges)

      expect(changes.alines.sha1).toEqual([1, 2, 5, 6, 7, 8, 14, 35])
    })

    test('should float lines if the user deletes a line', async () => {
      const vscodeChanges = {
        contentChanges: [{
          range: { _start: { _line:  5, _character: 0 }, _end: { _line:  6, _character: 0 } },
          text: '',
        }],
      }
      const changes = await setupChanges(vscodeChanges)

      // TEST
      CΩWorkspace.refreshLines(vscodeChanges)

      expect(changes.alines.sha1).toEqual([1, 2, 5, 6, 7, 13, 34])
    })

    test('should sink all lines if the user inserts a new line at the top', async () => {
      const vscodeChanges = {
        contentChanges: [{
          range: { _start: { _line:  0, _character: 0 }, _end: { _line:  0, _character: 0 } },
          text: '\n  ',
        }],
      }
      const changes = await setupChanges(vscodeChanges)

      // TEST
      CΩWorkspace.refreshLines(vscodeChanges)

      expect(changes.alines.sha1).toEqual([2, 3, 6, 7, 8, 9, 15, 36])
    })

    test('should float all lines if the user deletes the top line', async () => {
      const vscodeChanges = {
        contentChanges: [{
          range: { _start: { _line:  0, _character: 0 }, _end: { _line:  1, _character: 0 } },
          text: '',
        }],
      }
      const changes = await setupChanges(vscodeChanges)

      // TEST
      CΩWorkspace.refreshLines(vscodeChanges)

      expect(changes.alines.sha1).toEqual([0, 1, 4, 5, 6, 7, 13, 34])
    })
    */
  })

  describe('Receiving diffs', () => {
    /**
       * - serverDataContribReadme combines 3 users for lines: [1, 3, 6, 12, 34], but against two different SHA!
       * - git diff returns:
       *   { range: { line:  1, len: 1 }, replaceLen: 0 } // line 1 deleted : all lines >= 1 float (move to the top) one position
       *   { range: { line:  3, len: 1 }, replaceLen: 3 } // line 3 replaced with 3 lines: all lines >= 3 sink 2 positions
       *   { range: { line:  6, len: 0 }, replaceLen: 1 } // line 6: insert one line AFTER line 6: all lines >= 6 sink 1 position
       * - the user deletes lines [7~12] while the local git diff is pending: all lines >=7 float 5 positions, restricted at 7 (not allowed to float above 7).
       */
    /*
    test('should combine changed lines from all contributors, and local diffs', async () => {
      mockGitForDownloadDiffs()
      makeTokens({ store: true })
      CΩWorkspace.init()
      await CΩSCM.addProject(path.join(__dirname, '../fixtures/atom-svelte-transpiler'))
      const cΩ = '123'
      CΩStore.activeProjects = {}
      CΩStore.activeProjects[cΩ] = CΩStore.projects[0]
      const project = CΩStore.projects[0]
      setActiveTextEditor({ document: { getText: () => 'test' }, setDecorations: jest.fn() })
      project.editorDiff = {}
      // mock a delete 5 lines while pending git diff (user keyboard speed is fantastic!)
      project.editorDiff['README.md'] = [{ range: { line:  7, len: 5 }, replaceLen: 0 }]

      nock(CΩAPI.API_URL)
        .get(`${CΩAPI.API_REPO_CONTRIB}?origin=${project.origin}&fpath=README.md`, () => true)
        .reply(200, serverDataContribReadme)

      const apiSpy = jest.spyOn(CΩAPI, 'downloadDiffs')

      // TEST
      await CΩDiffs.refreshChanges(project, 'README.md')

      expect(apiSpy).toHaveBeenCalledTimes(1)
      // eslint-disable quote-props
      expect(project.changes['README.md'].alines).toEqual({
        '0705f99a4f61efc11b9681932f98254dd762a96c': [32],
        'd0da21a45767139a1860f35280e76a01997d5d6d': [1, 2, 7, 9],
      })
    })
    */
  })
})

/*
async function setupChanges(vscodeChanges, alines) {
  CΩWorkspace.init()
  CΩStore.user = { email: 'test@cΩ.com' }
  await CΩSCM.addProject(path.join(__dirname, '../fixtures/atom-svelte-transpiler'))
  const cΩ = '123'
  CΩStore.activeProjects = {}
  CΩStore.activeProjects[cΩ] = CΩStore.projects[0]
  const project = CΩStore.projects[0]
  project.cSHA = 'a9009b639bce9ff05a1cced7859b41687054bd5c'
  const fpath = 'README.md'
  setActiveTextEditor({
    document: {
      uri: { path: fpath },
      getText: () => README_MOCK,
    },
    setDecorations: jest.fn(),
  })
  project.activePath = fpath
  project.changes = {}
  project.changes[fpath] = { alines: alines || { sha1: [1, 2, 5, 6, 7, 8, 14, 35] } }
  return project.changes[fpath]
}
*/
