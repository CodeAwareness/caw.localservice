# Code Awareness client system service

This is the local (client) system service I call "the Gardener". In the Code Awareness architecture, the Gardener has the role of handling requests from different editors and applications, and performing the necessary git diffs and similar actions, communicating with the Code Awareness API in the cloud, and more.

This service needs to be wrapped and packaged separately for Windows, MacOS, Linux.

TODO: We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.

We're also using node-ipc for communication with editor plugins when we have access to unix pipes, or secure webSockets when we don't.

For clients that cannot use a Unix pipe, the service listens for websockets on port 48408. We have the port customization on our TODO list, since it's a complex problem involving coordination between this service and various clients, such as PowerPoint addons, VSCode extensions, vim/emacs plugins, etc.

## Getting Started

### Installation

Note: at this time I don't have a clean install that just works out-of-the-box. Instead you'll need a nodeJS environment, and you'll be running the local service in dev mode.

1. Clone the repo, install the dependencies.

```bash
yarn
```

2. Install localhost certificates (will only last for about a month I think):

```bash
npx office-addin-dev-certs install
```

Communication through Unix pipe does not require the use of a localhost certificate.

# Development setup

When you need to work with multiple components on the same local system, you'll need to install nginx and configure a common access port, to avoid CORS issues. In the case of VSCode, we do this to run both the local service and the VSCode webview panel on port 8885.

1. Install `nginx` and copy the `codeawareness.nginx.conf` into your servers folder. Restart nginx to take effect.

```bash
brew services restart nginx
```

# Run

```
yarn build
yarn start
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
