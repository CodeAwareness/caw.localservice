function auth(socket) {
  socket.use(([event, ...args], next) => {
    console.log('SOCKET TOKEN', socket.handshake.auth.token, socket.request.user)
    /* TODO: check token: (maybe move to Express middleware instead?)
        const token = socket.handshake.auth.token
        const err = new Error("not authorized")
        err.data = { content: "Invalid token" }
        next(err)
        */
    next()
  })
}

const wsEngine = {
  init: (app: any, wsIO: any) => {
    // initial mock until the real socket connects
    /* eslint-disable-next-line */
    app.userSocket = { emit: () => {}, to: () => ({ emit: () => {} }), join: () => {} };
    /* eslint-disable-next-line */
    app.repoSocket = { emit: () => {}, to: () => ({ emit: () => {} }), join: () => {} };
    // real sockets
    app.rootIONS = wsIO
      .on('connect', socket => {
        app.rootSocket = socket
        auth(socket)
      })
    /*
    app.userIONS = wsIO.of('/users')
      .on('connect', socket => {
        app.userSocket = socket
        auth(socket)
      })
    app.repoIONS = wsIO.of('/repos')
      .on('connect', socket => {
        app.repoSocket = socket
        auth(socket)
      })
      */
    app.wsIO = wsIO
  },

  reqHandler: (req: any, res: any, next: any) => {
    next()
  },
}

module.exports = wsEngine
