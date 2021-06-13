import express from 'express'
import cors from 'cors'
import httpStatus from 'http-status'

import config from './config/config'
import morgan from './config/morgan'
import { errorConverter, errorHandler } from './middlewares/error'
import ApiError from './utils/ApiError'

import routes from './routes/v1'

const app = express()

if (config.env !== 'test') {
  app.use(morgan.successHandler)
  app.use(morgan.errorHandler)
}

app.use(cors())

// parse json request body
app.use(express.json())

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }))

// api routes
app.use('/v1', routes)

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Route not found'))
})

// convert error to ApiError, if needed
app.use(errorConverter)

// handle error
app.use(errorHandler)

export default app
