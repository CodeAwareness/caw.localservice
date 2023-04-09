import dotenv from 'dotenv'
import path   from 'path'
import mkdirp from 'mkdirp'
import tmp from 'tmp'
import Keyv from 'keyv'

import Joi from '@hapi/joi'
import CAWStore from '@/services/store'
import logger from '@/logger'

const dbpath = path.join(process.cwd(), 'storage.sqlite')

export const shareStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'share' })
shareStore.on('error', err => console.error('SQLite storage: connection error', err))

export const authStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'auth' })
authStore.on('error', err => console.error('SQLite storage: connection error', err))

// Setting up a temporary folder to work in
CAWStore.tmpDir = tmp.dirSync({ prefix: 'caw', keep: true, unsafeCleanup: true }).name
CAWStore.uTmpDir = {} // instance based temp dir

const API_ROOT = path.join(__dirname, '../../')

dotenv.config({ path: path.join(API_ROOT, '.env') })

const uploadDir: string = path.join(API_ROOT, '_uploadDiffs')
mkdirp.sync(uploadDir)

const envVarsSchema = Joi.object()
  .keys({
    CAW_CATALOG: Joi.string().default('catalog'),
    CAW_DEBUG: Joi.string().default('all'),
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(48048),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)
const DEBUG = ['development', 'test'].includes(envVars.NODE_ENV)
const LOCAL = !!envVars.LOCAL_API
const TRACE = !!envVars.TRACE
logger.init(envVars.CAW_DEBUG, TRACE)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const PORT_LOCAL = envVars.PORT
const PORT_LOCAL_API = 3008

/* The REST API */
const API_SERVER = LOCAL ? `localhost:${PORT_LOCAL_API}` : 'api.codeawareness.com'
const API_URL = DEBUG ? `http://${API_SERVER}/v1` : `https://${API_SERVER}/v1`

/* This WSS API will be used to sync up comments, perform voice/video conference etc */
const SERVER_WSS = LOCAL ? `ws://localhost:${PORT_LOCAL_API}` : 'wss://api.codeawareness.com'
const WSS_NAMESPACE = 'svc'

const PIPE_CATALOG = DEBUG ? envVars.CAW_CATALOG + '_dev' : envVars.CAW_CATALOG
console.log('connecting to catalog', PIPE_CATALOG)
// TODO: move some of this config into a .caw file, either toml or yaml
const CONFIGURATION_FILE = '.caw'
const CODE_AWARENESS_SCHEMA = 'CAW'
const SYNC_INTERVAL = 100 * 1000 // upload local diffs to the server every minute or so
const SYNC_THRESHOLD = 1000 // don't sync too often
const MAX_NR_OF_SHA_TO_COMPARE = 5

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
  DEBUG,
  EXTRACT_BRANCH_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  MAX_NR_OF_SHA_TO_COMPARE,
  CODE_AWARENESS_SCHEMA,
  PIPE_CATALOG,
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
