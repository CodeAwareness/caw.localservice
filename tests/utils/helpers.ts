import { faker } from '@faker-js/faker'
import path from 'path'
import nock from 'nock'

import { GIT_MOCKS } from '../fixtures/git-mocks'

import config from '@/config/config'
import git from '@/services/git'
import CAWAPI from '@/services/api'
import CAWStore from '@/services/store'
import RepoController from '@/controllers/repo.controller'

export function prepareTmp(cid) {
  let tmp
  const ws = {
    emit: arg => (tmp = arg.tmpDir)
  }
  RepoController.getTmpDir.bind(ws)(cid)
  return tmp
}

export function prepareProject(cid) {
  const data = {
    fpath: path.join(__dirname, '../fixtures/atom-svelte-transpiler/README.md'),
    cid: 123,
    doc: '',
  }

  let project
  const mockEmit = {
    emit: (k, p) => (project = p)
  }

  return RepoController
    .activatePath.bind(mockEmit)(data)
    .then(() => project)
}

let gitDiffIndex = 0
export function mockGitForSendDiffs() {
  return {
    gitBranches: jest.spyOn(git, 'getBranches').mockImplementation(() => Promise.resolve({ branch: 'main', branches: ['main', 'dev', 'light'] })),
    gitRemotes: jest.spyOn(git, 'getRemotes').mockImplementation(() => Promise.resolve('github.com/CodeAwareness/test')),
    gitCommand: jest.spyOn(git, 'command').mockImplementation((wsFolder, cmd) => new Promise((resolve, _reject) => {
      if (cmd === 'git fetch') resolve(GIT_MOCKS.FETCH)
      if (cmd.substr(0, 10) === 'git branch') resolve(GIT_MOCKS.BRANCH)
      if (cmd.substr(0, 12) === 'git ls-files') resolve(GIT_MOCKS.LS_FILES)
      if (cmd.substr(0, 10) === 'git log -n') resolve(GIT_MOCKS.LOG_N)
      if (cmd.substr(0, 29) === 'git log --pretty="%cd %H" -n1') resolve(GIT_MOCKS.LOG_SINCE)
      if (cmd.substr(0, 16) === 'git log --pretty') resolve(GIT_MOCKS.LOG_PRETTY)
      if (cmd.substr(0, 16) === 'git for-each-ref') resolve(GIT_MOCKS.FOR_EACH_REF)
      if (cmd.substr(0, 12) === 'git rev-list') resolve(GIT_MOCKS.REV_LIST)
      if (cmd.substr(0, 19) === 'git --no-pager diff') resolve(GIT_MOCKS.DIFF_UNTRACKED[gitDiffIndex++])
      if (cmd.substr(0, 15) === 'git diff -b -U0') resolve(GIT_MOCKS.DIFF_U)
    })),
  }
}

export function mockGitForDownloadDiffs() {
  return {
    gitRemotes: jest.spyOn(git, 'getRemotes').mockImplementation(() => Promise.resolve('github.com/codeawareness/test')),
    gitCommand: jest.spyOn(git, 'command')
      .mockImplementationOnce((_wsFolder, _cmd) => new Promise((resolve, _reject) => {
        resolve(GIT_MOCKS.DIFF_ARCHIVE)
      }))
      .mockImplementationOnce((_wsFolder, _cmd) => new Promise((resolve, _reject) => {
        resolve(GIT_MOCKS.DIFF_README)
      }))
      .mockImplementationOnce((_wsFolder, _cmd) => new Promise((resolve, _reject) => {
        resolve(GIT_MOCKS.DIFF_ARCHIVE2)
      }))
      .mockImplementationOnce((_wsFolder, _cmd) => new Promise((resolve, _reject) => {
        resolve(GIT_MOCKS.DIFF_README2)
      }))
  }
}

export function resetMocks() {
  gitDiffIndex = 0
}

export function makeTokens(options) {
  const access = { expires: new Date().valueOf() + 10000, token: faker.string.uuid() }
  const refresh = { expires: new Date().valueOf() + 60000, token: faker.string.uuid() }
  const preEmpt = 2000
  const newAccess = { expires: new Date().valueOf() + 20000, token: faker.string.uuid() }
  const newRefresh = { expires: new Date().valueOf() + 70000, token: faker.string.uuid() }
  const tokens = { access: newAccess, refresh: newRefresh }
  if (options && options.store) {
    CAWStore.tokens = { access, refresh }
    CAWStore.user = { _id: faker.string.uuid(), email: faker.internet.email() }
  }

  let nockPersist
  if (options.addRefreshMock) {
    nockPersist = nock(config.API_URL)
      .post(CAWAPI.API_AUTH_REFRESH_TOKENS)
      .reply(200, { tokens })

    if (options.persist) nockPersist.persist()
  }

  return { access, refresh, preEmpt, newAccess, newRefresh, nockPersist }
}
