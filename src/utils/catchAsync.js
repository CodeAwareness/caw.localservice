/* @flow */

const catchAsync = (fn: any): any => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => console.error(err))
}

module.exports = catchAsync
