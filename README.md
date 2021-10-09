# CodeAwareness client system service

This is a local (client) system service that needs to be wrapped and compiled specifically for Windows, MacOS, Linux.
We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.
We're also using node-ipc for communication with the editor plugins.

The service listens on port 48408. We have the port customization on our TODO list, since it's a complex problem involving coordination between this service and various clients, such as PowerPoint addons, VSCode extensions, vim/emacs plugins, etc.

## Getting Started

### Installation

Clone the repo, install the dependencies and set the environment variables.

```bash
# open .env and modify the environment variables
```

### Commands

Running locally:

```bash
yarn dev
```

Running in production:

```bash
yarn start
```

Testing:

```bash
# run all tests
yarn test

# run all tests in watch mode
yarn test:watch

# run test coverage
yarn coverage
```

Linting:

```bash
# run ESLint
yarn lint

# fix ESLint errors
yarn lint:fix
```

## Architecture

`cA.localservice` is an OS service that listens to HTTP requests from your editors (Visual Studio Code, vim, etc) and performs the necessary actions for CodeAwareness.

This service is composed of the following components:

### Authorization

ACTIONS: login, logout

NOTES:

When it's possible to run a web component as an editor plugin/extension/add-on, the registration and proper login are handled by the web component. We only need a mechanism to keep the token alive, and two methods for storing the tokens (login) and clearing them out (logout).

In the case of editors like vim, I have to decide whether to reproduce the web component functionality inside the vim plugin, or write them inside the OS service instead. I've decided to keep it inside the plugin, simply because making a call to an external API is almost no different from communicating with a system socket. In addition, one OS service should be able to handle requests from multiple editors, and that makes things a lot more complicated for the OS service. Instead, making each editor instance responsible for their own authentication improves the security of the overall system and simplifies the logic of each component.

### Users

ACTIONS: getUsers
The getusers action is used to retrieve user profile information for a list of user ids.

### Repos

ACTIONS: add, remove, addSubmodules, removeSubmodules, swarmAuth, getContributors, uploadDiffs, getDiffFile, postCommitList, findCommonSHA, getRepo

### Adhoc

ACTIONS: add, remove, swarmAuth, uploadDiffs, getContributors, getDiffFile, getRepo

The adhoc mode is for working on files and folders which are not a git repository, such as PowerPoint files and school projects.
For example, in a school project setting, the teacher will setup a local folder, on teacher's computer, to be CodeAware.

### Discussions

ACTIONS: getDiscussions, comment

