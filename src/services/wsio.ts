const wsEngine = {
  init: (app: any, wsIO: any) => {
    console.log('INIT websocket')
    // real sockets
    app.rootIONS = wsIO
      .on('connect', socket => {
        console.log('Websocket CONNECTED')
        app.rootSocket = socket
      })
    app.wsIO = wsIO
  },

  reqHandler: (req: any, res: any, next: any) => {
    console.log('WS request handler')
    next()
  },
}

export default wsEngine
