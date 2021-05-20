# CodeAwareness system service

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

`peer8.service` is an OS service that listens to HTTP requests from your editors (Visual Studio Code, vim, etc) and performs the necessary actions for CodeAwareness.

This service is composed of the following components:

### Authorization

ACTIONS: login, logout, refresh-tokens

NOTES:

For the case of an editor where it's possible to run a web component, the registration and proper login are handled by the web component. We only need a mechanism to keep the token alive, and two methods for storing the tokens (login) and clearing them out (logout).

In the case of editors like vim, we have to decide whether to reproduce the web component functionality inside the vim plugin, or write them inside the OS service instead. I've decided to keep it inside the plugin, simply because making a call to an external API is almost no different from communicating with a system socket. In addition, one OS service should be able to handle requests from multiple editors, and that makes things a lot more complicated for the OS service. Instead, making each editor instance responsible for their own authentication improves the security of the overall system and simplifies the logic of each component.

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

