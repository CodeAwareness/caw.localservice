import rateLimit from 'express-rate-limit'

const authLimiter: any = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
})

module.exports = {
  authLimiter,
}
