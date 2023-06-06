require('dotenv').config()

const PORT_LOCAL = 8886
const CONFIGURATION_FILE = '.codeawareness'
const PEER8_SCHEMA = 'codeawareness'
const EXT_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}` : 'https://ext.peer8.com' // Peer8 Webview server
const API_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}/api/v1` : 'https://api.peer8.com/v1'
const SYNC_INTERVAL = 1000 // download diffs from the server every minute !! IMPORTANT: this is currently used in both workspace and diffs
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

export {
  API_URL,
  CONFIGURATION_FILE,
  EXT_URL,
  EXTRACT_BRANCH_DIR,
  EXTRACT_LOCAL_DIR,
  EXTRACT_PEER_DIR,
  EXTRACT_REPO_DIR,
  LOG_LEVEL,
  MAX_NR_OF_SHA_TO_COMPARE,
  PEER8_SCHEMA,
  PORT_LOCAL,
  SYNC_INTERVAL,
}
