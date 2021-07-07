import express from 'express'
import cors from 'cors'

import config from './config/config'
import morgan from './config/morgan'
import routes from './routes/v1/http.route'

type ExpressPeer8 = Partial<express.Application> &
  { rootSocket: any }

const app = express() as unknown as ExpressPeer8

if (config.env !== 'test') {
  app.use(morgan.successHandler)
  app.use(morgan.errorHandler)
}

app.use(cors())

app.use('/v1', routes)

// parse json request body
app.use(express.json())

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }))

export default app
