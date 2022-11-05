# CodeAwareness client system service

This is a local (client) system service that needs to be wrapped and compiled separately for Windows, MacOS, Linux.

Naming is a serious challenge here, so I'm trying this:

  - the codeAwareness.com API is called `API` and is located out there in the cloud
  - the local server (client side) is called `grandStation` and listens to WSS 48408 port, to which all installed applications can connect.
  - the local socket client is called `gardener` and is responsible for receiving websocket messages from the `API`. This is in a TODO phase, but the intention is to enable some real time functionality between peers.
  - the CodeAwareness extensions for VSCode, vim / emacs plugin, Powerpoint add-on, etc, every single one is a `poodle`. These poodles are very busy showing people how cute they are.

We could use node-windows, node-mac, and systemd to ensure proper launching, restarting and logging.
We're also using node-ipc for communication with editor plugins when we have access to unix pipes, or secure webSockets when we don't.

The service listens on port 48408. We have the port customization on our TODO list, since it's a complex problem involving coordination between this service and various clients, such as PowerPoint addons, VSCode extensions, vim/emacs plugins, etc.

## Getting Started

### Installation

1. Clone the repo, install the dependencies.

```bash
yarn
```

2. Install localhost certificates (will only last for about a month):

```bash
npx office-addin-dev-certs install
```

2. Install `nginx` and copy the `codeawareness.nginx.conf` into your servers folder. Restart nginx to take effect.

```bash
brew services restart nginx
```

### Run

```
yarn build
yarn start
```

### Testing:

NOTE: Tests don't yet work. We're currently working on porting tests from an older version of this project.
```bash
# run all tests
yarn test

# run all tests in watch mode
yarn test:watch

# run test coverage
yarn coverage
```

### Linting:

```bash
# run ESLint
yarn lint

# fix ESLint errors
yarn lint:fix
```

## TODO

- reconnect existing pipes upon restart
