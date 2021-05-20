/* @flow */

/**
 * Create an object composed of the picked object properties
 * @param {Object} object
 * @param {string[]} keys
 * @returns {Object}
 */
const pick = (object: any, keys: any): any => {
  return keys.reduce((obj, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key)) {
      // eslint-disable-next-line no-param-reassign
      // eslint-disable-next-line security/detect-object-injection
      obj[key] = object[key]
    }
    return obj
  }, {})
}

module.exports = pick
