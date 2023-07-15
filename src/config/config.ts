import dotenv from 'dotenv'
import path   from 'path'
import tmp from 'tmp'
import Keyv from 'keyv'

import Joi from '@hapi/joi'
import CAWStore from '@/services/store'
import logger from '@/logger'

const dbpath = path.join(process.cwd(), 'storage.sqlite')

/* Local storage for repos */
export const repoStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'repo' })
repoStore.on('error', err => console.error('SQLite storage: connection error', err))

/* Local storage for sharing files */
export const shareStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'share' })
shareStore.on('error', err => console.error('SQLite storage: connection error', err))

/* Local storage for authorization tokens */
export const authStore = new Keyv(`sqlite://${dbpath}`, { namespace: 'auth' })
authStore.on('error', err => console.error('SQLite storage: connection error', err))

/* Setting up a temporary folder to work in */
CAWStore.tmpDir = tmp.dirSync({ prefix: 'caw', keep: true, unsafeCleanup: true }).name
CAWStore.uTmpDir = {} // instance based temp dir

const LS_ROOT = path.join(__dirname, '../../')

dotenv.config({ path: path.join(LS_ROOT, '.env') })

const envVarsSchema = Joi.object()
  .keys({
    /* CAW_CATALOG: the filename for our app catalog;
    * locally installed apps with CodeAwareness extensions will subscribe to CodeAwareness by adding themselves to this file */
    CAW_CATALOG: Joi.string().default('catalog'),
    /* CAW_DEBUG: a list of DEBUG categories you wish to log in the console */
    CAW_DEBUG: Joi.string().default('all'),
    /* NODE_ENV: self explanatory really */
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)
const DEBUG = ['development', 'test'].includes(envVars.NODE_ENV)
const LOCAL = !!envVars.LOCAL_API // When the CodeAwareness API is installed locally, set this to true
const TRACE = !!envVars.TRACE // Trace code in console.logs; this helps with identifying the exact location for errors and warnings

logger.init(envVars.CAW_DEBUG, TRACE)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const PORT_LOCAL_API = 3008

/* CodeAwarenesss REST API */
const API_URL = LOCAL ? `http://localhost:${PORT_LOCAL_API}/v1` : 'https://api.codeawareness.com/v1'

/* This WSS API will be used to sync up comments, perform voice/video conference etc */
const SERVER_WSS = LOCAL ? `ws://localhost:${PORT_LOCAL_API}` : 'wss://api.codeawareness.com'
const WSS_NAMESPACE = 'svc'

const PIPE_CATALOG = DEBUG ? envVars.CAW_CATALOG + '_dev' : envVars.CAW_CATALOG

// TODO: move some of this config into a .caw file, either toml or yaml
const CONFIGURATION_FILE = '.caw'
const SYNC_INTERVAL = 6 * 60 * 1000 // upload local diffs to the server every minute or so
const SYNC_THRESHOLD = 1000 // don't sync too often

// We aggregate changes against multiple SHA values. This is the maximum nr of previous commits we consider for our diffs.
const MAX_NR_OF_SHA_TO_COMPARE = 20

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug' // ['verbose', 'debug', 'error']

// ARCHIVE_DIR where we unpack the previous version of a file from the git repository
const ARCHIVE_DIR = 'a'

// EXTRACT_BRANCH_DIR where we extract the file from a specific branch, to be compared with the activeTextEditor
const EXTRACT_BRANCH_DIR = 'b'

// EXTRACT_DOWNLOAD_DIR where we download all the diff files from peers
const EXTRACT_DOWNLOAD_DIR = 'd'

// EXTRACT_LOCAL_DIR where we write the contents of the activeTextEditor, to be compared with peer files or otherwise processed with git commands
const EXTRACT_LOCAL_DIR = 'l'

// EXTRACT_REPO_DIR where we gather all the files from common SHA commit, but only those touched by a peer
const EXTRACT_REPO_DIR = 'r'

// EXTRACT_PEER_DIR where we have the peer versions of the files
const EXTRACT_PEER_DIR = 'e'

const Config = {
  API_URL,
  ARCHIVE_DIR,
  CONFIGURATION_FILE,
  DEBUG,
  EXTRACT_BRANCH_DIR,
  EXTRACT_DOWNLOAD_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  MAX_NR_OF_SHA_TO_COMPARE,
  PIPE_CATALOG,
  SERVER_WSS,
  SYNC_INTERVAL,
  SYNC_THRESHOLD,
  WSS_NAMESPACE,
  authStore,
  env: envVars.NODE_ENV,
  host: '127.0.0.1',
  port: envVars.PORT,
  repoStore,
  shareStore,
}

export default Config
