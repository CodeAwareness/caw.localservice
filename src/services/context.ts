import * as _ from 'lodash'
import { AxiosResponse } from 'axios'

import Config from '@/config/config'
import logger from '@/logger'

import CAWStore from './store'
import CAWAPI, { API_CONTEXT_LINES, API_CONTEXT_NEW } from '@/services/api'

function applyContext(data) {
  return CAWAPI.axiosAPI
    .post(API_CONTEXT_NEW, data)
    .then(res => res.data)
}

function sendSelection({ origin, activePath, selections }) {
  return CAWAPI.axiosAPI
    .post(API_CONTEXT_LINES, { origin, activePath, selections })
    .then(res => res.data)
}

export default {
  applyContext,
  sendSelection,
}
