import dotenv from 'dotenv'
import path   from 'path'
import mkdirp from 'mkdirp'
import tmp from 'tmp'
import Keyv from 'keyv'

import Joi    from '@hapi/joi'
import { CΩStore } from '@/services/store'

const dbpath = path.join(process.cwd(), 'storage.sqlite')

export const shareStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'share' })
shareStore.on('error', err => console.error('SQLite storage: connection error', err))

export const authStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'auth' })
authStore.on('error', err => console.error('SQLite storage: connection error', err))

// Setting up a temporary folder to work in
CΩStore.tmpDir = tmp.dirSync({ prefix: 'cΩ', keep: true, unsafeCleanup: true }).name
CΩStore.uTmpDir = {} // instance based temp dir

const API_ROOT = path.join(__dirname, '../../')

dotenv.config({ path: path.join(API_ROOT, '.env') })

const uploadDir: string = path.join(API_ROOT, '_uploadDiffs')
mkdirp.sync(uploadDir)

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
const PORT_LOCAL_API = 3008
const API_SERVER = process.env.LOCAL ? `localhost:${PORT_LOCAL_API}`      : 'api.codeawareness.com'
const API_URL    = process.env.LOCAL ? `http://${API_SERVER}/v1`          : `https://${API_SERVER}/v1`
const SERVER_WSS = process.env.LOCAL ? `ws://localhost:${PORT_LOCAL_API}` : 'wss://api.codeawareness.com'
const WSS_NAMESPACE = 'svc'

const CONFIGURATION_FILE = '.CΩ'
const CODE_AWARENESS_SCHEMA = 'CΩ'
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
  API_SERVER,
  API_URL,
  CONFIGURATION_FILE,
  EXTRACT_BRANCH_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  MAX_NR_OF_SHA_TO_COMPARE,
  CODE_AWARENESS_SCHEMA,
  PORT_LOCAL,
  SERVER_WSS,
  SYNC_INTERVAL,
  SYNC_THRESHOLD,
  WSS_NAMESPACE,
  authStore,
  env: envVars.NODE_ENV,
  host: '127.0.0.1',
  port: envVars.PORT,
  shareStore,
  uploadDir,
}

export default Config
