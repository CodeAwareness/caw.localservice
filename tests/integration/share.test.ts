import request from 'supertest'
import httpStatus from 'http-status'
import nock from 'nock'
import mkdirp from 'mkdirp'
import * as _ from 'lodash'
import * as util from 'util'
import * as child from 'child_process'

import app from '../../src/app'
import { API_REPO_CONTRIB, API_SHARE_START, API_SHARE_UPLOAD } from '../../src/services/api'
import Config from '../../src/config/config'
import { Peer8Store } from '../../src/services/peer8.store'

// TODO: Windows env setup
const tmpDir = '/tmp/peer8.local-service'
const exec = util.promisify(child.exec)

beforeAll(() => {
  nock.enableNetConnect('127.0.0.1')
})

beforeEach(() => {
  jest.clearAllMocks()
  nock.cleanAll()
  Peer8Store.emtpy()
  // TODO: Windows env setup
  Peer8Store.tmpDir = tmpDir
  mkdirp.sync(Peer8Store.tmpDir)
})

afterEach(() => {
  if (!nock.isDone()) {
    console.error(new Error('Not all nock interceptors were used!'))
    console.log('Unresolved mocks:', nock.pendingMocks())
    nock.cleanAll()
  }
})

afterAll(() => {
  nock.restore()
  nock.cleanAll()
})

describe('Share service', () => {
  describe('startSharing', () => {
    test('should setup a list of share groups', async () => {
      nock(Config.API_URL)
        .post(API_SHARE_START, () => true)
        .reply(200, {
          origin: 'test-origin',
          invitationLinks: [
            { splitOrigin: 'test-origin/123', group: 'group01' },
            { splitOrigin: 'test-origin/124', group: 'group02' },
          ]
        })

      // TEST
      const res = await request(app)
        .post('/v1/share/start')
        .send({ groups: ['group01', 'group02'] })
        .expect(httpStatus.OK)

      // EXPECT : dummy expectation for this one, just to make sure the code runs without errors
      expect(res.body.origin).toEqual('test-origin')
    })
  })

  describe('Upload share', () => {
    test('Should upload original ppt file', async () => {
      const docDir = `${tmpDir}/documents`
      mkdirp.sync(docDir)
      await exec(`cp ../fixtures/my.pptx ${docDir}/`, { cwd: __dirname })

      nock(Config.API_URL)
        .post(API_SHARE_UPLOAD, () => true)
        .reply(200, { o: 'test-origin', n: 'my.pptx' })

      nock(Config.API_URL)
        .post(API_REPO_CONTRIB, () => true)
        .reply(200, {
          users: [{ _id: 1, email: 'alice@peer8.com' }, { _id: 2, email: 'bob@peer8.com' }],
          file: { r: '123-objid-test-repo', f: 'my.pptx' },
        })

      // TEST
      const res = await request(app)
        .post('/v1/share/uploadOriginal')
        .send({
          fpath: `${tmpDir}/documents/my.pptx`,
          origin: 'test-origin',
        })
        .expect(httpStatus.OK)

      expect(res.body.origin).toEqual('test-origin')
      expect(res.body.wsFolder).toMatch(/^\/tmp\/peer8.local-service\//)
    })
  })
})
