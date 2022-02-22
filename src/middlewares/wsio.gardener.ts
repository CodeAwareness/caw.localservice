import { CΩStore } from '@/services/cA.store'

function auth() {
  // tcClient.setToken(CΩStore.tokens?.access?.token)
}

function connect(options) {
  console.log('Gardener connect. Options: ', options)
}

function transmit(cmd: string, data?: any) {
  console.log('Gardener transmit', cmd, data)
}

const tcClient = {
  auth,
  connect,
  transmit,
}

export default tcClient
