const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt')

const { User } = require('@/models')

const config = require('./config')

const jwtOptions = Object.assign({
  secretOrKey: config.jwt.secret,
  // clockTolerance: 5,
  algorithms: ['HS384'],
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
}, config.jwt.options)

const jwtVerify = async (payload, done) => {
  try {
    const user = await User.findById(payload.sub)
    if (!user) {
      return done(null, false)
    }
    done(null, user)
  } catch (error) {
    done(error, false)
  }
}

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify)

module.exports = {
  jwtStrategy,
}
