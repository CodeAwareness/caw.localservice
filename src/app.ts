import express from 'express'
import cors from 'cors'

import config from './config/config'
import morgan from './config/morgan'
import httpRoutes from './routes/v1/http.route'

export type CΩExpress = Partial<express.Application> &
  {
    apiSocket: any,
    localSocket: any,
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
