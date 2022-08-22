import { map } from 'lodash'
import api from '@/services/api'

/* eslint-disable no-console */
const logger = {
  log: function(...args: any[]): void {
    console.log('CΩLS:', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/log`, args)
  },
  info: function(...args: any[]): void {
    console.info('CΩLS:', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/info`, args)
  },
  warn: function(...args: any[]): void {
    console.warn('CΩLS:', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/warn`, args)
  },
  debug: function(...args: any[]): void {
    console.info('CΩLS:', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/debug`, args)
  },
  error: function(...args: any[]): void {
    console.error('CΩLS:', map(args, JSON.stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/error`, args)
  },
}

export default logger
