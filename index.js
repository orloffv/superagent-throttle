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
 * ## hasCapacity
 * checks whether instance has available capacity either in rate or in
 * concurrency
 *
 * @method
 * @returns {Boolean}
 */
Throttle.prototype.hasCapacity = function() {
  // make requestTimes `this.rate` long. Oldest request will be 0th index
  if (this._requestTimes.length > this.rate) {
    this._requestTimes = _.castArray(_.last(this._requestTimes, this.rate))
  }
  return (
    // not paused
    (this.active) &&
    // not at concurrency limit
    (this._current < this.concurrent) &&
    // less than `ratePer`
    ((Date.now() - this._requestTimes[0]) > this.ratePer) &&
    // something waiting in the throttle
    (this._buffer.length)
  )
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

  // fire requests
  while (throttle.hasCapacity()) {


    // hasCapacity might return true when all buffered requests are
    // serialised
    let idx = _.findIndex(throttle._buffer, function(buffered) {
      return !buffered.uri || !throttle._serials[buffered.uri]
    })
    
    console.log(idx)
    let buffered = throttle._buffer.splice(idx, 1)[0]
    if (buffered.uri) {
      throttle._serials[buffered.uri] = true
    }
    // attend to the throttle once we get a response
    buffered.request.on('end', function() {
      throttle._current -= 1
      throttle.cycle(uri)
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
