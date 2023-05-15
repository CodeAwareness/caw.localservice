/* eslint-disable @typescript-eslint/no-empty-function */
import { map } from 'lodash'

let trains = ['all']
let traceEnabled = true

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
  return JSON.stringify(arg, circularReplacer())?.substring(0, 1500).replace(/("[^ "]+:[^ "]+")/, '\x1b[33m$1\x1b[0m')
}

function trace() {
  if (!traceEnabled) return
  const lines = getStackTrace().split('\n').filter(l => (l.includes('localservice') && !l.includes('logger') && !l.includes('node_modules')))
  lines.push('')
  console.debug(lines.join('\n'))
}

/* eslint-disable no-console */
/* eslint-disable n/handle-callback-err */
/*
const loggerForGoogle = {
  log: function(...args: any[]): void {
    console.log('CAW.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
  },
  info: function(...args: any[]): void {
    console.info('CAW.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
  },
  warn: function(...args: any[]): void {
    console.warn('CAW.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
  },
  debug: function(...args: any[]): void {
    console.info('CAW.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
  },
  error: function(...args: any[]): void {
    console.error('CAW.LS:', map(args, stringify))
    trace()
    args.unshift('GRAND STATION')
  },
}
*/

const loggerConsole = {
  init: function(domains, trace) {
    trains = domains.toLowerCase().split(',')
    traceEnabled = trace
    console.log('LOGGER: init', trains)
  },
  log: function(...args: any[]): void {
    try {
      if (!trains.includes(args[0]?.toLowerCase().split(':')[0]) && !trains.includes('all')) return
    } catch (err) {}
    trace()
    console.dir(args, { depth: 6 })
  },
  info: function(...args: any[]): void {
    try {
      if (!trains.includes(args[0]?.toLowerCase().split(':')[0]) && !trains.includes('all')) return
    } catch (err) {}
    trace()
    console.info(map(args, stringify).join(' '))
  },
  warn: function(...args: any[]): void {
    try {
      if (!trains.includes(args[0]?.toLowerCase().split(':')[0]) && !trains.includes('all')) return
    } catch (err) {}
    trace()
    console.warn(args)
  },
  debug: function(...args: any[]): void {
    try {
      if (!trains.includes(args[0]?.toLowerCase().split(':')[0]) && !trains.includes('all')) return
    } catch (err) {}
    trace()
    console.info(args)
  },
  error: function(...args: any[]): void {
    try {
      if (!trains.includes(args[0]?.toLowerCase().split(':')[0]) && !trains.includes('all')) return
    } catch (err) {}
    trace()
    console.error(args)
  },
}

export default loggerConsole
