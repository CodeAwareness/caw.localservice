# Code Awareness client system service

This is the local (client) system service I call "the Gardener". In the Code Awareness architecture, the Gardener has the role of handling requests from different editors and applications, and performing the necessary actions to aggregate and transmit code differences to the Code Awareness API in the cloud.

This service needs to be wrapped and packaged separately for Windows, MacOS, Linux.

TODO: We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.

We're using a unix pipe (or windows named pipes) for communication with editor plugins.

## Getting Started

### Installation

There is no installer at the moment, just an executable that you can download and run in a command prompt (terminal) window. This executable is the workhorse for the entire system, allowing multiple clients, such as Visual Studio Code, to connect.
Once the Code Awareness service is running, you can then download and install the Visual Studio Code extension from our website and start working as you would usually. The VSCode statusbar will show a CodeAwareness link which you can click to bring up the interface. You can register for an account directly from VSCode, and start seeing the benefits. Close the Code Awareness panel to remove the code highlights from your editors. With the panel closed, you'll only be seeing the orange markers on the right-side gutter, that indicate lines changed by your team members.

You could also install the source code for both the service and the extension. Just clone the repo, install the dependencies and follow the Deelopment setup section below. You'll need a functional nodeJS environment (16 or greater) to do this.

```bash
yarn

or

npm install
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

- lots and lots of todo items sprinkled throughout the code and in my personal notes. If anyone wants to help out or partner with me, please contact me:

mark@codeawareness.com
