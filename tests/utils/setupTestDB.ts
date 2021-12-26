import mongoose from 'mongoose'
import config from '@/config/config'

mongoose.set('debug', false)

const setupTestDB = () => {
  beforeAll(async () => {
    await mongoose.connect(config.mongoose.url, config.mongoose.options)
  })

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(async (collection) => collection.deleteMany()))
  })

  afterAll(async () => {
    await mongoose.disconnect()
  })
}

module.exports = setupTestDB
