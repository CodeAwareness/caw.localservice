import request from 'supertest'
import httpStatus from 'http-status'
import nock from 'nock'
import mkdirp from 'mkdirp'
import * as path from 'path'
import * as _ from 'lodash'
import * as util from 'util'
import * as child from 'child_process'

import app from '../../src/app'
import { API_REPO_CONTRIB, API_SHARE_ACCEPT, API_SHARE_START, API_SHARE_UPLOAD } from '../../src/services/api'
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
  describe('Starting a share should create groups and invitation links', () => {
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

    test('Should upload original ppt file and create a workspace directory', async () => {
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

    test('Should download a shared file from provided invitation link', async () => {
      const docDir = `${tmpDir}/documents`
      mkdirp.sync(docDir)
      await exec(`cp ../fixtures/my.pptx ${docDir}/`, { cwd: __dirname })

      const origin = 'test-origin'
      const uri = encodeURIComponent(origin)
      nock(Config.API_URL)
        .get(`${API_SHARE_ACCEPT}?origin=${uri}`)
        .reply(200, { url: 'https://s3.peer8.com/some-id-test-origin/my.pptx' })

      nock('https://s3.peer8.com')
        .get('/some-id-test-origin/my.pptx')
        .reply(200, {})

      // TEST
      const res = await request(app)
        .post('/v1/share/accept')
        .send({
          origin: 'test-origin',
        })
        .expect(httpStatus.OK)

      expect(res.body.peerFile).toMatch(/\/tmp\/peer8.local-service\/[a-z0-9]+\/l\/my.pptx/)
    })

    test('Should setup the received shared file in a new workspace', async () => {
      const docDir = `${tmpDir}/documents`
      mkdirp.sync(docDir)

      // TEST
      const res = await request(app)
        .post('/v1/share/setupReceived')
        .send({
          origin: 'test-origin',
          fpath: path.join(__dirname, '../fixtures/my.pptx'),
        })
        .expect(httpStatus.OK)

      expect(res.body.fpath).toMatch(/fixtures\/my.pptx/)
      expect(res.body.wsFolder).toMatch(/\/tmp\/peer8.local-service\//)
    })

    test.only('When opening a file, we should be able to find its origin on CodeAwareness', async () => {
      const docDir = `${tmpDir}/documents`
      mkdirp.sync(docDir)
      const s3key = encodeURIComponent('test-origin-s3-id.zip')

      // TEST
      const res = await request(app)
        .get(`/v1/share/getFileOrigin?f=${s3key}`)
        .send({
          origin: 'test-origin',
          fpath: path.join(__dirname, '../fixtures/my.pptx'),
        })
        .expect(httpStatus.OK)
    })
  })
})
