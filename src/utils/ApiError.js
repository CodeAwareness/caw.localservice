/* @flow */

class ApiError extends Error {
  constructor(statusCode: number, message: string, isOperational: boolean = true, stack: string = '') {
    super(message)
    // $FlowFixMe[prop-missing]
    this.statusCode = statusCode
    // $FlowFixMe[prop-missing]
    this.isOperational = isOperational
    /* TODO: better error logging, something here spits out errors with stacks even when FORBIDDEN, UNAUTHORIZED */
    if (stack) {
      this.stack = stack
    } else {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

module.exports = ApiError
