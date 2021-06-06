const throttle: any = (routeName) => (req, res, next) => {
  // TODO: get payment plan subscription and throttle accordingly
  return next()
}

module.exports = throttle
