/* @flow */

const dotenv = require('dotenv')
const packageRoot = require('pkg-dir')
const path   = require('path')
const mkdir  = require('mkdirp').sync
const tmp = require('tmp')

const Joi    = require('@hapi/joi')

// Setting up a temporary folder to work in
const { Peer8Store } = require('@/services/peer8.store')
Peer8Store.tmpDir = tmp.dirSync({ prefix: 'peer8_', keep: true, unsafeCleanup: true }).name

const API_ROOT = packageRoot.sync(__dirname)

dotenv.config({ path: path.join(API_ROOT, '.env') })

const uploadDir: string = path.join(API_ROOT, '_uploadDiffs')
mkdir(uploadDir)

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(48408),
  })
  .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
  throw new Error(`Config validation error: ${error.message}`)
}

const PORT_LOCAL = envVars.PORT || 48048
const API_URL = process.env.LOCAL ? `http://localhost:${PORT_LOCAL}/api/v1` : 'https://api.peer8.com/v1'

module.exports = {
  API_URL,
  // TODO: make COMMON_SHA_EXPIRATION a function of subscription plan
  COMMON_SHA_EXPIRATION: 60 * 1000, // once we computed the common SHA, we cache it and only re-compute if older than 1 minute
  MAX_COMMITS_IN_LIST: 10000,
  env: envVars.NODE_ENV,
  host: '127.0.0.1',
  port: envVars.PORT,
  uploadDir,
}
