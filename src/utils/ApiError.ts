import logger from '@/logger'

class ApiError extends Error {
  private statusCode: number
  private isOperational: boolean

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    /* TODO: better error logging, something here spits out errors with stacks even when FORBIDDEN, UNAUTHORIZED */
    if (stack) {
      logger.log('API ERROR STACK:', stack)
      this.stack = stack
    }
  }
}

export default ApiError
