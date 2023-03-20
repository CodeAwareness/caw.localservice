import express from 'express'
import cors from 'cors'

import config from './config/config'
import morgan from './config/morgan'
import httpRoutes from './routes/v1/x-http.route'

// We only need express for PowerPoint auth, since PPT doesn't allow sockets in their extensions.
export type CAWExpress = Partial<express.Application> &
  {
    gstationSocket: any,
    gardenerSocket: any,
    gstationNS: any, // websocket Namespace
    gstationWS: any, // websocket server
  }

export type CAWRequest = Partial<express.Request>

export type CAWResponse = express.Response

export type CAWNext = express.NextFunction

const app = express() as unknown as CAWExpress

if (config.env !== 'test') {
  app.use(morgan.successHandler)
  app.use(morgan.errorHandler)
}

app.use(cors())

app.use('/v1', httpRoutes)

// parse json request body
app.use(express.json())

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }))

export default app
