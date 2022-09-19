import { faker } from '@faker-js/faker'
import nock from 'nock'

import git from '../../src/services/git'
import { GIT_MOCKS } from '../fixtures/git-mocks'

import CΩAPI from '../../src/services/api'
import config from '../../src/config/config'
import { CΩStore } from '../../src/services/store'

let gitDiffIndex = 0
export function mockGitForSendDiffs() {
  return {
    gitBranches: jest.spyOn(git, 'getBranches').mockImplementation(() => Promise.resolve({ branch: 'main', branches: ['main', 'dev', 'light'] })),
    gitRemotes: jest.spyOn(git, 'getRemotes').mockImplementation(() => Promise.resolve('github.com/peer8/test')),
    gitCommand: jest.spyOn(git, 'command').mockImplementation((wsFolder, cmd) => new Promise((resolve, reject) => {
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
    gitRemotes: jest.spyOn(git, 'getRemotes').mockImplementation(() => Promise.resolve('github.com/peer8/test')),
    gitCommand: jest.spyOn(git, 'command')
      .mockImplementationOnce((wsFolder, cmd) => new Promise((resolve, reject) => {
        resolve(GIT_MOCKS.DIFF_ARCHIVE)
      }))
      .mockImplementationOnce((wsFolder, cmd) => new Promise((resolve, reject) => {
        resolve(GIT_MOCKS.DIFF_README)
      }))
      .mockImplementationOnce((wsFolder, cmd) => new Promise((resolve, reject) => {
        resolve(GIT_MOCKS.DIFF_ARCHIVE2)
      }))
      .mockImplementationOnce((wsFolder, cmd) => new Promise((resolve, reject) => {
        resolve(GIT_MOCKS.DIFF_README2)
      }))
  }
}

export function resetMocks() {
  gitDiffIndex = 0
}

export function makeTokens(options) {
  const access = { expires: new Date().valueOf() + 10000, token: faker.datatype.uuid() }
  const refresh = { expires: new Date().valueOf() + 60000, token: faker.datatype.uuid() }
  const preEmpt = 2000
  const newAccess = { expires: new Date().valueOf() + 20000, token: faker.datatype.uuid() }
  const newRefresh = { expires: new Date().valueOf() + 70000, token: faker.datatype.uuid() }
  const tokens = { access: newAccess, refresh: newRefresh }
  if (options && options.store) {
    CΩStore.tokens = { access, refresh }
    CΩStore.user = { _id: faker.datatype.uuid(), email: faker.internet.email() }
  }

  let nockPersist
  if (options.addRefreshMock) {
    nockPersist = nock(config.API_URL)
      .post(CΩAPI.API_AUTH_REFRESH_TOKENS)
      .reply(200, { tokens })

    if (options.persist) nockPersist.persist()
  }

  return { access, refresh, preEmpt, newAccess, newRefresh, nockPersist }
}
