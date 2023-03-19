/* eslint-disable @typescript-eslint/no-empty-function */
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

function getStackTrace() {
  const obj: any = {}
  Error.captureStackTrace(obj, getStackTrace)
  return obj.stack
}

function stringify(arg) {
  return JSON.stringify(arg, circularReplacer())?.substr(0, 1500)
}

function trace() {
  const lines = getStackTrace().split('\n').filter(l => (l.includes('localservice') && !l.includes('logger') && !l.includes('node_modules')))
  lines.push('')
  console.debug(lines.join('\n'))
}

/* eslint-disable no-console */
/* eslint-disable n/handle-callback-err */
const logger = {
  log: function(...args: any[]): void {
    console.log('CΩ.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/log`, args).catch(_err => {})
  },
  info: function(...args: any[]): void {
    console.info('CΩ.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/info`, args).catch(_err => {})
  },
  warn: function(...args: any[]): void {
    console.warn('CΩ.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/warn`, args).catch(_err => {})
  },
  debug: function(...args: any[]): void {
    console.info('CΩ.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/debug`, args).catch(_err => {})
  },
  error: function(...args: any[]): void {
    console.error('CΩ.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
    api.axiosAPI.post(`${api.API_LOG}/error`, args).catch(_err => {})
  },
}

const loggerConsole = {
  log: function(...args: any[]): void {
    trace()
    args.unshift('GRAND STATION')
    console.log('CΩ.LS:', map(args, stringify))
  },
  info: function(...args: any[]): void {
    trace()
    args.unshift('GRAND STATION')
    console.info('CΩ.LS:', map(args, stringify))
  },
  warn: function(...args: any[]): void {
    trace()
    args.unshift('GRAND STATION')
    console.warn('CΩ.LS:', map(args, stringify))
  },
  debug: function(...args: any[]): void {
    trace()
    args.unshift('GRAND STATION')
    console.info('CΩ.LS:', map(args, stringify))
  },
  error: function(...args: any[]): void {
    trace()
    args.unshift('GRAND STATION')
    console.error('CΩ.LS:', map(args, stringify))
  },
}

export default loggerConsole
