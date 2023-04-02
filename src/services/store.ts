import config from '@/config/config'

const CAWStore = {
  colorTheme: 1, // 1 = Light, 2 = Dark, 3 = High Contrast
  user: undefined,
  tokens: undefined,
  panel: undefined,

  /* tmpDir: {
   *   name: '/tmp/caw-12750-bA2Le6JKQ4Ad/'
   *   ... // see npm tmp package
   * }
   */
  tmpDir: undefined,

  /*
   * instance based temp directories (one for each CID)
   * uTmpDir: {
   *   qwe123: '/tmp/caw_12750-bA2L/',
   *   dfk230: '/tmp/caw_2245h-hJ2k',
   * }
   */
  uTmpDir: {},

  /*
   * One editor, such as VSCode may have multiple projects open in the same window (workspaces).
   *
   * projects: [{
   *   name, // convenience property = basename(root)
   *   root, // root path
   *   origin, // e.g. `https://github.com/codeawareness/codeawareness.vscode.git`
   *   repo, // repo object (vscode or atom specific)
   *   branch, // current branch
   *   branches, // list of local branches
   *   scm, // Source Control Manager (VSCode)
   *   scIndex, // VSCode SCM index
   *   team, // the team name, i.e. a team of peers with whom to share visibility (TODO)
   *   head, // the current commit (HEAD)
   *   cSHA, // the common SHA against which we diff all peers
   *   contributors, // comments, code contributors
   *   pendingGitDiff, // true / false - the local git diff operation is pending
   *   activePath, // currently opened file, relative path
   *   line, // current cursor line
   *   gitDiff: {
   *     'src/index.js': {
   *       range: { line: 12, len: 0 }, // len: 0 indicates an insert op
   *       replaceLen: 2,
   *     },
   *     ...
   *   }
   *   editorDiff: {
   *     'src/index.js': [
   *       {
   *         range: { line: 41, len: 3 },
   *         replaceLen: 0, // a delete op
   *       },
   *       {
   *         range: { line: 64, len: 2 },
   *         replaceLen: 4, // a replace op of original 2 lines with 4 new lines
   *       },
   *       ...
   *     ],
   *     ...
   *   },
   *   changes: {
   *     'src/index.js': {
   *       uid1: { l: [1, 4, 5, 10], s: sha1, k: s3key1 },
   *       uid2: { l: [1, 3, 4, 5], s: sha1, k: s3key2 },
   *       ...
   *     },
   *     ...
   *   }
   *   selectedContributor, // currently selected contributor for diffs
   *   }, ...]
   */
  projects: [],

  /*
   * activeProjects: {
   *   'sjwk123': { ... }, // active project for cid = 'sjwk123'
   *   'dh84hjk': { ... }, // active project for cid = 'dh84hjk'
   * }
   */
  activeProjects: {},

  /*
   * Each client uses a timer for each project, to sync up code diffs with the server.
   * We store these timers one for each project root, to avoid sync problems when the user has the same repo in two different local directories.
   */
  timers: {},

  /* selectedContributor: {
   *   diffDir, // the temp folder where the file is extracted
   *   diff, // filename only of the current diff
   *   lupd, // date of file update
   *   origin, // github url of this repo
   *   email, // contributor email address
   *   avatar, // contributor profile pic
   *   user, // contributor user id
   *   _id, // contribution id
   * }
   */
  selectedContributor: undefined,

  /* selectedBranch: 'dev'
  */
  selectedBranch: undefined,

  /* swarmStatus indicates whether the swarm authorization is pending or ready
  */
  swarmAuthStatus: undefined,

  /* peerFS: {
   *   wsFolder: {
   *     folderName1: {
   *       fileName11: {},
   *       folderName11: {
   *         fileName111: {},
   *       },
   *     },
   *     folderName2: {
   *       fileName21: {},
   *     },
   *     fileName1: {}
   *     ...
   *   }
   * }
   *
   * Just a tree structure, hashed for faster locating of files and folders
   */
  peerFS: {},

  doc: undefined, // active document (specific doc format for Atom, VSCode)
  line: 0, // cursor line nr in document

  wsStation: {}, // Socket sync with CodeAwareness extensions (one socket for each client / editor extension)
  wsGardener: null, // socketIO sync with CodeAwareness API (a single socket)

  clear: () => {
    CAWStore.selectedContributor = undefined
  },

  reset: (caw?: string) => {
    CAWStore.tokens = undefined
    CAWStore.user = undefined
    CAWStore.panel = undefined
    CAWStore.colorTheme = 1
    CAWStore.projects = []
    if (caw) CAWStore.activeProjects[caw] = undefined
    else CAWStore.activeProjects = {}
    CAWStore.selectedBranch = undefined
    CAWStore.selectedContributor = undefined
    CAWStore.peerFS = {}
    CAWStore.doc = undefined
    CAWStore.line = 0
    CAWStore.wsStation = undefined
    CAWStore.wsGardener = undefined
  },

  setAuth: async ({ user, tokens }) => {
    CAWStore.user = user
    CAWStore.tokens = tokens
    await config.authStore.set('user', CAWStore.user)
    await config.authStore.set('tokens', CAWStore.tokens)
  }
}

export const CAWWork = {
  // terminal (optional feature: client side processing using shell commands)
  tokenInterval: 0,
  syncTimer: null,
}

export default CAWStore
