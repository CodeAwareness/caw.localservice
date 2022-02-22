const https = require('https')
const devCerts = require("office-addin-dev-certs") // Thank you Microsoft.
// TODO: security review, tighten host access
devCerts.getHttpsServerOptions()
  .then(options => {
    const server = https.createServer(options, function(req, res) {
      res.end('This is servered over HTTPS')
    })

    /*
    server.listen(4433, function() {
      console.log('The server is running on https://localhost:4433')
    })
    */
  })
