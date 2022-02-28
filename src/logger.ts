import { map } from 'lodash'
import api from '@/services/api'

/* eslint-disable no-console */
const logger = {
  log: function(...args: any[]): void {
    console.log('PeerWeb.', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/log`, args)
  },
  info: function(...args: any[]): void {
    console.info('PeerWeb.', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/info`, args)
  },
  warn: function(...args: any[]): void {
    console.warn('PeerWeb.', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/warn`, args)
  },
  debug: function(...args: any[]): void {
    console.info('PeerWeb.', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/debug`, args)
  },
  error: function(...args: any[]): void {
    console.error('PeerWeb.', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/error`, args)
  },
}

export default logger
