'use strict'
const _       = require('lodash')
const debug   = require('debug')

/**
 * ## debugging
 * For debuging output to stdout, set debug environment variable a la:
 * `DEBUG=superagent-throttle:* node myapp.js`
 */
const dbg = {
  fn: debug('superagent-throttle:fn'),
  req: debug('superagent-throttle:req'),
  timeout: debug('superagent-throttle:timeout')
}

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
  ratePer: 40000,
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
  dbg.fn('Throttle constructor')
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
  // bind plugin to instance, so when it's called with the old
  // `.use(throttle.plugin)` syntax plugin function will have reference to this
  this.plugin = _.bind(this.plugin, this)
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
  dbg.fn('set')
  if (_.isString(options) && value) {
    options = {}
    options[options] = value
  }
  _.extend(this, options)
  this.cycle()
}

/**
 * ## next
 * checks whether instance has available capacity and calls throttle.send()
 *
 * @returns {Boolean}
 */
Throttle.prototype.next = function() {
  dbg.fn('next')
  let throttle = this
  // make requestTimes `throttle.rate` long. Oldest request will be 0th index
  throttle._requestTimes = _.slice(
    throttle._requestTimes,
    throttle.rate * -1
  )

  if (
    // paused
    !(throttle.active) ||
    // at concurrency limit
    (throttle._current > throttle.concurrent) ||
    // less than `ratePer`
    throttle._isRateBound() ||
    // something waiting in the throttle
    !(throttle._buffer.length)
  ) {
    return false
  }
  let idx = _.findIndex(throttle._buffer, function(request) {
    return !request.serial || !throttle._serials[request.serial]
  })
  if (idx === -1) {
    throttle._isSerialBound = true
    return false
  }
  throttle.send(throttle._buffer.splice(idx, 1)[0])
  return true
}

/**
 * ## serial
 * updates throttle.\_serials and throttle.\_isRateBound
 *
 * serial subthrottles allow some requests to be serialised, whilst maintaining
 * their place in the queue. The _serials structure keeps track of what serial
 * queues are waiting for a response.
 *
 * ```
 * throttle._serials = {
 *   'example.com/end/point': true,
 *   'example.com/another': false
 * }
 * ```
 *
 * @param {Request} request superagent request
 * @param {Boolean} state new state for serial
 */
Throttle.prototype.serial = function(request, state) {
  dbg.fn('serial')
  let serials = this._serials
  let throttle = this
  if (request.serial === false) {
    return
  }
  if (state === undefined) {
    return serials[request.serial]
  }
  if (state === false) {
    throttle._isSerialBound = false
  }
  serials[request.serial] = state
}

/**
 * ## _isRateBound
 * returns true if throttle is bound by rate
 *
 * @returns {Boolean}
 */
Throttle.prototype._isRateBound = function() {
  let throttle = this
  dbg.fn('isRateBound')
  return (
    ((Date.now() - throttle._requestTimes[0]) < throttle.ratePer) &&
    (throttle._buffer.length > 0)
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
 * @param {Request} request the superagent request
 * @returns null
 */
Throttle.prototype.cycle = function(request) {
  dbg.fn('cycle')
  let throttle = this
  if (request) {
    throttle._buffer.push(request)
  }
  clearTimeout(throttle._timeout)

  // fire requests
  // throttle.next will return false if there's no capacity or throttle is
  // drained
  while (throttle.next()) {}

  // if bound by rate, set timeout to reassess later.
  if (throttle._isRateBound()) {
    let timeout = throttle.ratePer - (Date.now() - throttle._requestTimes[0])
    dbg.timeout('set for %sms', timeout)
    throttle._timeout = setTimeout(function() {
      dbg.timeout('callback')
      throttle.cycle()
    }, timeout)
  }
}

/**
 * ## send
 *
 * @param {Request} request superagent request
 * @returns null
 */
Throttle.prototype.send = function(request) {
  dbg.fn('send')
  let throttle = this
  throttle.serial(request, true)
  // attend to the throttle once we get a response
  request.on('end', function() {
    dbg.req('received')
    throttle._current -= 1
    throttle.serial(this, false)
    throttle.cycle()
  })
  dbg.req('sent (%s queued)', throttle._buffer.length)
  request.throttled.call(request)
  throttle._requestTimes.push(Date.now())
  throttle._current += 1
}

/**
 * ## plugin
 *
 * `superagent` `use` function should refer to this plugin method a la
 * `.use(throttle.plugin())`
 *
 * @method
 * @param {string} serial any string is ok, it's just a namespace
 * @returns null
 */
Throttle.prototype.plugin = function(serial) {
  dbg.fn('plugin')
  let throttle = this
  let patch = function(request) {
    dbg.fn('plugin anon')
    request.throttle = throttle
    request.serial = serial || false
    // replace request.end
    request.throttled = request.end
    request.end = function(callback) {
      dbg.fn('patched end')
      // the only param passed to .end is the callback, so we can just store
      // that on the emitter, and don't need to deal any other arguments
      // passed in
      request.on('end', callback)
      // place this request in the queue
      request.throttle.cycle(request)
      return request
    }
    return request
  }
  return _.isObject(serial) ? patch(serial) : patch
}



module.exports = Throttle
