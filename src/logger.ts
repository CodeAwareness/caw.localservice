import { map } from 'lodash'
import api from '@/services/api'

const circularReplacer = () => {
  const seen = new WeakSet()
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return
      seen.add(value)
    }
    return value
  }
}

function stringify(arg) {
  return JSON.stringify(arg, circularReplacer())?.substr(0, 1500)
}

/* eslint-disable no-console */
/* eslint-disable n/handle-callback-err */
const logger = {
  log: function(...args: any[]): void {
    console.log('CΩ.LS:', map(args, stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/log`, args).catch(err => {})
  },
  info: function(...args: any[]): void {
    console.info('CΩ.LS:', map(args, stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/info`, args).catch(err => {})
  },
  warn: function(...args: any[]): void {
    console.warn('CΩ.LS:', map(args, stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/warn`, args).catch(err => {})
  },
  debug: function(...args: any[]): void {
    console.info('CΩ.LS:', map(args, stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/debug`, args).catch(err => {})
  },
  error: function(...args: any[]): void {
    console.error('CΩ.LS:', map(args, stringify))
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/error`, args).catch(err => {})
  },
}

export default logger
