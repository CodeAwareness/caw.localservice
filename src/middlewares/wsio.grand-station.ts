import config from '@/config/config'
import type { TTransientSocketOptions } from '@transient/client'
import tcClient from '@transient/client'
import { CΩStore } from '@/services/cA.store'

const options: TTransientSocketOptions = {
  reconnectionDelayMax: 20000,
  forceNew: true,
  transports: ['websocket'],
  // @ts-ignore: No overload matches this call.
  origins: ['*'],
  withCredentials: true,
  timestampRequests: true,
  auth: { token: CΩStore.tokens?.access?.token },
}

const init = () => {
  tcClient.connect({ url: config.SERVER_WSS, ns: config.WSS_NAMESPACE, options })
}

export default Object.assign(tcClient, { init })
