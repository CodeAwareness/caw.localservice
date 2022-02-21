import type { TTransientConfig } from '@transient/client'
import TCClient from '@transient/client'
import { CΩStore } from '@/services/cA.store'

const clientOptions: TTransientConfig = {
  logger: console
}

const tcClient = new TCClient(clientOptions)

const auth = () => {
  tcClient.setToken(CΩStore.tokens?.access?.token)
}

export default tcClient
