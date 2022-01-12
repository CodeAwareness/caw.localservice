import express from 'express'
import cors from 'cors'

import config from './config/config'
import morgan from './config/morgan'
import httpRoutes from './routes/v1/x-http.route'

// We only need express for PowerPoint auth, since PPT doesn't allow sockets in their extensions.
export type CΩExpress = Partial<express.Application> &
  {
    gStationSocket: any,
    gardenerSocket: any,
    gardenerNS: any, // websocket Namespace
    gardenerWS: any, // websocket server
  }

export type CΩRequest = Partial<express.Request>

export type CΩResponse = express.Response

export type CΩNext = express.NextFunction

const app = express() as unknown as CΩExpress

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
