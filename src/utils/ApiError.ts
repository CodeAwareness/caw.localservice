class ApiError extends Error {
  private statusCode
  private isOperational

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    /* TODO: better error logging, something here spits out errors with stacks even when FORBIDDEN, UNAUTHORIZED */
    if (stack) {
      console.log('API ERROR STACK:', stack)
      this.stack = stack
    } else {
      console.log('API ERROR CAPTURE STACK:')
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export default ApiError
