/* @flow */

const catchAsync = (fn: any): any => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => next(err))
}

module.exports = catchAsync
