import morgan from 'morgan'

import logger from '@/config/logger'

morgan.token('message', (req, res) => res?.locals?.errorMessage || '')

const successResponseFormat = ':method :url :status - :response-time ms'
const errorResponseFormat = ':method :url :status - :response-time ms - message: :message'

const successHandler = morgan(successResponseFormat, {
  skip: (req, res) => res.statusCode >= 400,
  stream: { write: (message) => logger.info(message.trim()) },
})

const errorHandler = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 400,
  stream: { write: (message) => logger.error(message.trim()) },
})

const Morgan = {
  successHandler,
  errorHandler,
}

export default Morgan
