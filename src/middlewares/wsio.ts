import router from '../routes/v1'

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
        // auth(socket) // TODO: secure this server connection a bit more than just CORS
        router.init()
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

export default wsEngine
