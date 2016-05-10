'use strict'
const _ = require('lodash')

let Throttle

/**
 * ## default options
 */
let defaults = {
  // not sure if `name` is used anymore
  name: 'default',
  // start unpaused ?
  active: true,
  // requests per `ratePer` ms
  rate: 40,
  // ms per `rate` requests
  ratePer: 10000,
  // max concurrent requests
  concurrent: 20
}

/**
 * ## Throttle
 * The throttle object.
 *
 * @class
 * @param {object} options - key value options
 */
Throttle = function(options) {
  this.set(_.extend(
    // instance properties
    {
      _requestTimes: [0],
      _current: 0,
      _buffer: [],
      _serials: {},
      _timeout: false
    },
    defaults,
    options
  ))
}

/**
 * ## set
 * update options on instance
 *
 * alternate syntax:
 * throttle.set('active', true)
 * throttle.set({active: true})
 *
 * @method
 * @param {String|Object} options - either key value object or keyname
 * @param {Mixed} [value] - value for key
 * @returns null
 */
Throttle.prototype.set = function(options, value) {
  if (_.isString(options) && value) {
    options = {}
    options[options] = value
  }
  _.extend(this, options)
  this.cycle()
}

/**
 * ## next
 * checks whether instance has available capacity and returns index
 * of correct request
 *
 * @method
 * @returns {Boolean}
 */
Throttle.prototype.next = function() {
  let throttle = this
  // make requestTimes `throttle.rate` long. Oldest request will be 0th index
  if (throttle._requestTimes.length > throttle.rate) {
    throttle._requestTimes = _.castArray(_.last(throttle._requestTimes, throttle.rate))
  }
  if (
    // not paused
    !(throttle.active) ||
    // not at concurrency limit
    !(throttle._current < throttle.concurrent) ||
    // less than `ratePer`
    !((Date.now() - throttle._requestTimes[0]) > throttle.ratePer) ||
    // something waiting in the throttle
    !(throttle._buffer.length)
  ) {
    return false
  }
  let idx = _.findIndex(throttle._buffer, function(buffered) {
    return !buffered.uri || !throttle._serials[buffered.uri]
  })
  if (idx === -1) {
    return false
  }
  return throttle._buffer.splice(idx, 1)[0]
}

/**
 * ## cycle
 * an iterator of sorts. Should be called when
 *  - something added to throttle (check if it can be sent immediately)
 *  - `ratePer` ms have elapsed since nth last call where n is `rate` (may have
 *    available rate)
 *  - some request has ended (may have available concurrency)
 *
 * @param {Function} [fn] - a function which fires a request, use the enclosed
 *   nature of fn to store arguments et cetera
 * @returns null
 */
Throttle.prototype.cycle = function(buffered, uri) {
  let throttle = this
  if (_.isString(buffered)) {
    uri = buffered
    buffered = undefined
  }
  if (uri) {
    throttle._serials[uri] = false
  }
  if (buffered) {
    throttle._buffer.push(buffered)
  }
  clearTimeout(throttle._timeout)
  console.log(throttle._serials)

  // fire requests
  // reuse of variable is a bit naughty
  while (buffered = throttle.next()) {
    if (buffered.uri) {
      throttle._serials[buffered.uri] = true
    }
    // attend to the throttle once we get a response
    buffered.request.on('end', function() {
      throttle._current -= 1
      throttle.cycle(uri)
      if (buffered.uri) {
        throttle._serials[buffered.uri] = false
      }
    })
    buffered.request.throttled.apply(
      buffered.request,
      buffered.arguments
    )
    throttle._requestTimes.push(Date.now())
    throttle._current += 1
  }

  if (
    // if:
    //  - no more throttled items
    //  - paused
    //  - waiting for concurrency
    // then: do nothing, cycle will be called again when these states change.
    (throttle._buffer.length === 0) ||
    (!throttle.active) ||
    (throttle._current >= throttle.concurrent)
  ) {
    return
  } else if (
    // if:
    //  - limited by rate
    // then:
    //  - a timer must be set
    (throttle._current < throttle.concurrent)
  ) {
    throttle._timeout = setTimeout(function() {
      throttle.cycle()
    }, throttle.ratePer - (Date.now() - throttle._requestTimes[0]))
  }
}

/**
 * ## plugin
 *
 * `superagent` `use` function should refer to this plugin method a la
 * `.use(throttle.plugin())`
 *
 * @method
 * @param {string} uri any string is ok, uri as in namespace
 * @returns null
 */
Throttle.prototype.plugin = function(uri) {
  let throttle = this
  return function(request) {
    request.throttle = throttle
    // replace request.end
    request.throttled = request.end
    request.end = function() {
      request.throttle.cycle({
        request: request,
        arguments: arguments,
        uri: uri
      })
      return request
    }
  }
  return request
}

module.exports = Throttle
