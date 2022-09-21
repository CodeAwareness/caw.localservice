# CodeAwareness client system service

This is a local (client) system service that needs to be wrapped and compiled specifically for Windows, MacOS, Linux.

Naming is a serious challenge here, so I'm trying this:

  - the codeawareness.com API is called `API` and is located out there in the cloud
  - the local server (client side) is called `grandStation` and listens to a wss 48408 port, to which all applications which have CodeAwareness extension installed can connect.
  - the local socket client is called `gardener` and is responsible for receiving websocket messages from the `API`
  - the VSCode extension, vim / emacs plugin, etc, every single one is a `poodle`. These poodles are very busy showing people how cute they are.

We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.
We're also using node-ipc for communication with editor plugins when we have access to unix pipes, or secure webSockets when we don't.

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

To install or reinstall certificates:

```
npx office-addin-dev-certs install
brew services restart nginx
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

`cA.localservice` is an OS service that listens to requests from your editors (Visual Studio Code, vim, etc) and performs the necessary actions for CodeAwareness.

This service is composed of the following components:

### Authorization

ACTIONS: login, logout, info, passwordAssist, reAuthorize, sendLatestSHA

NOTES:
For now, the grandStation takes care of authentication with the API, and it's only done once for any number of CodeAwareness enabled applications on one client.

WARNING:
The Swarm Authentication we're using requires that we identify users by commit SHA and date. Therefore, when contributing to this project, make sure to NOT send commit sha values to other users, even when they are authenticated. If you do, a user can perpetually stay on the repo authorized list, even after being excluded from the github/gitlab repository.

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

