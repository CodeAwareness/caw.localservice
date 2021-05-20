const dotenv = require('dotenv')
const packageRoot = require('pkg-dir')
const path   = require('path')
const mkdir  = require('mkdirp').sync
const Joi    = require('@hapi/joi')

const API_ROOT = packageRoot.sync(__dirname)

dotenv.config({ path: path.join(API_ROOT, '.env') })

const uploadDir: string = path.join(API_ROOT, '_uploadDiffs')
mkdir(uploadDir)

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  // TODO: make COMMON_SHA_EXPIRATION a function of subscription plan
  COMMON_SHA_EXPIRATION: 60 * 1000, // once we computed the common SHA, we cache it and only re-compute if older than 1 minute
  MAX_COMMITS_IN_LIST: 10000,
  uploadDir,
}
