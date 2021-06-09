import dotenv from 'dotenv'
import packageRoot from 'pkg-dir'
import path   from 'path'
import { sync as mkdir } from 'mkdirp'
import tmp from 'tmp'
import Keyv from 'keyv'

import Joi    from '@hapi/joi'
import { Peer8Store } from '../services/peer8.store'

const dbpath = path.join(process.cwd(), 'storage.sqlite')

export const shareStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'share' })
shareStore.on('error', err => console.error('SQLite storage: connection error', err))

export const authStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'auth' })
authStore.on('error', err => console.error('SQLite storage: connection error', err))

// Setting up a temporary folder to work in
Peer8Store.tmpDir = tmp.dirSync({ prefix: 'peer8', keep: true, unsafeCleanup: true }).name

const API_ROOT = packageRoot.sync(__dirname)

dotenv.config({ path: path.join(API_ROOT, '.env') })

const uploadDir: string = path.join(API_ROOT, '_uploadDiffs')
mkdir(uploadDir)

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(48408),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const PORT_LOCAL = envVars.PORT || 48048
const API_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}/api/v1` : 'https://ppt.peer8.com/v1'

const CONFIGURATION_FILE = '.peer8'
const PEER8_SCHEMA = 'peer8'
const SYNC_INTERVAL = 100 * 1000 // download diffs from the server every some time
const SYNC_THRESHOLD = 1000 // don't sync too often
const MAX_NR_OF_SHA_TO_COMPARE = 5

// console.log('CONFIG: (local, SYNC_INTERVAL, API_URL, EXT_URL)', process.env.LOCAL, SYNC_INTERVAL, API_URL, EXT_URL)

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug' // ['verbose', 'debug', 'error']

// EXTRACT_BRANCH_DIR where we extract the file from a specific branch, to be compared with the activeTextEditor
const EXTRACT_BRANCH_DIR = 'b'

// EXTRACT_LOCAL_DIR where we write the contents of the activeTextEditor, to be compared with peer files or otherwise processed with git commands
const EXTRACT_LOCAL_DIR = 'l'

// EXTRACT_REPO_DIR where we gather all the files from common SHA commit, but only those touched by a peer
const EXTRACT_REPO_DIR = 'r'

// EXTRACT_PEER_DIR where we have the peer versions for the files touched by a single peer
const EXTRACT_PEER_DIR = 'e'

const Config = {
  API_URL,
  CONFIGURATION_FILE,
  EXTRACT_BRANCH_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  MAX_NR_OF_SHA_TO_COMPARE,
  PEER8_SCHEMA,
  PORT_LOCAL,
  SYNC_INTERVAL,
  SYNC_THRESHOLD,
  authStore,
  env: envVars.NODE_ENV,
  host: '127.0.0.1',
  port: envVars.PORT,
  shareStore,
  uploadDir,
}

export default Config