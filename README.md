# Code Awareness client system service

This is the local (client) system service I call "the Gardener". In the Code Awareness architecture, the Gardener has the role of handling requests from different editors and applications, and performing the necessary actions to aggregate and transmit code differences to the Code Awareness API in the cloud.

This service needs to be wrapped and packaged separately for Windows, MacOS, Linux.

TODO: We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.

We're using a unix pipe (or windows named pipes) for communication with editor plugins.

## Getting Started

### Installation

Note: at this time I don't have a clean install that just works out-of-the-box. Instead you'll need a nodeJS environment, and you'll be running the local service in dev mode.

Clone the repo, install the dependencies.

```bash
yarn
```

# Development setup

When you need to work with multiple components on the same local system, you'll need to install nginx and configure a common access port, to avoid CORS issues. In the case of VSCode, we do this to run both the local service and the VSCode webview panel on port 8885.

# Run

```
yarn build
yarn start
```

# Multi-user run

Running multiple CodeAwareness LS instances allows you to use different usernames for different clients. This is how i made the presentation video for Code Awareness. Just make sure you modify the client extension to point to the right catalog file pipe.

Step 1. Run the CodeAwareness LS in your existing folder, with default parameters:
```
cd ca.localservice
CAW_CATALOG=catalog yarn dev
```

Step 2. Link the folder to a new location and run it with new parameters:
```
cd ../
ln -s ca.localservice ca.2.localservice
CAW_CATALOG=catalog2 yarn dev
```

# Debug levels

Our localservice has a ton of logs, which can make it hard to debug. To print only specific debug messages, take a look at the logger patterns in our code and use the one you want. For example, we can print only IPC and DIFFS logs by running LS with the following environment variables:

```
CAW_CATALOG=catalog2 DEBUG=ipc,diffs yarn dev
```

# Test

NOTE: Tests don't yet work. We're currently working on porting tests from an older version of this project.
```bash
# run all tests
yarn test

# run all tests in watch mode
yarn test:watch

# run test coverage
yarn coverage
```

# Lint

```bash
# run ESLint
yarn lint

# fix ESLint errors
yarn lint:fix
```

# TODO

- reconnect existing pipes upon restart (if it's even possible...). Currently, if you restart the local service you'll have to re-login on every client app.
