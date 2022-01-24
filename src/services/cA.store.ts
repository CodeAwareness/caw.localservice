export const CΩStore = {
  colorTheme: 1, // 1 = Light, 2 = Dark, 3 = High Contrast
  user: undefined,
  tokens: undefined,
  panel: undefined,

  /* tmpDir: {
   *   name: '/tmp/cA_-12750-bA2Le6JKQ4Ad/'
   *   ... // see npm tmp package
   * }
   */
  tmpDir: undefined,

  /* projects: [{
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

  /* activeProject: {
   *   (same as projects, plus:)
   *   activePath, // currently opened file, relative path
   *   line, // current cursor line
   * }
  */
  activeProject: undefined,

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

  wsStation: undefined, // socketIO Client communicating with CodeAwareness

  wsGardener: undefined, // socketIO Server communicating with the editors

  clear: () => {
    CΩStore.selectedContributor = undefined
  },

  emtpy: () => {
    CΩStore.tokens = undefined
    CΩStore.user = undefined
    CΩStore.panel = undefined
    CΩStore.colorTheme = 1
    CΩStore.tmpDir = undefined
    CΩStore.projects = []
    CΩStore.activeProject = undefined
    CΩStore.selectedBranch = undefined
    CΩStore.selectedContributor = undefined
    CΩStore.peerFS = {}
    CΩStore.doc = undefined
    CΩStore.line = 0
    CΩStore.wsStation = undefined
    CΩStore.wsGardener = undefined
  },
}

export const CΩWork = {
  // terminal (optional feature: client side processing using shell commands)
  tokenInterval: 0,
  syncTimer: null,
}
