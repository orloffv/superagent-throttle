var _ = require('underscore')

var Throttle;

var defaults = {
  name: 'default',
  active: true,
  rate: 40,
  ratePer: 10000,
  concurrent: 20
};

/**
 * Throttle
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
      _timeout: false
    },
    defaults,
    options
  ))
  this.bindPlugin()
};

/**
 * set
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
 * hasCapacity
 * checks whether instance has available capacity either in rate or in
 * concurrency
 *
 * @method
 * @returns {Boolean}
 */
Throttle.prototype.hasCapacity = function() {
  // make requestTimes `this.rate` long. Oldest request will be 0th index
  if (this._requestTimes.length > this.rate) {
    this._requestTimes = _.last(this._requestTimes, this.rate);
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
  );
};

/**
 * cycle
 * an iterator of sorts. Should be called when
 *  - something added to throttle (check if it can be sent immediately)
 *  - `ratePer` ms have elapsed since nth last call where n is `rate` (may have
 *    available rate)
 *  - some request has ended (may have available concurrency)
 *
 * @method
 * @param {Function} [fn] - a function which fires a request, use the enclosed
 *   nature of fn to store arguments et cetera
 * @returns null
 */
Throttle.prototype.cycle = function(fn) {
  var throttle = this;

  clearTimeout(throttle._timeout);
  if (fn) {
    throttle._buffer.push(fn);
  }
  // fire requests
  while (throttle.hasCapacity()) {
    throttle._buffer.shift()();
    throttle._requestTimes.push(Date.now());
    throttle._current += 1;
  }


  if (
    // if:
    //  - no more throttled items
    //  - paused
    //  - waiting for concurrency
    // then: do nothing, cycle will be called again when these states change.
    (throttle._buffer.length == 0) ||
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
      throttle.cycle();
    }, throttle.ratePer - (Date.now() - throttle._requestTimes[0]));
  }
};

/**
 * bindPlugin
 * create an instance method called `plugin` it needs an enclosure like this to
 * store a reference to the throttle, otherwise the plugin, when called by
 * superagent, will have no reference to itself.
 * this should be called by the class constructor
 *
 * `superagent` `use` function should refer to this plugin method a la
 * `.use(throttle.plugin)`
 *
 * @method
 * @returns null
 */
Throttle.prototype.bindPlugin = function() {
  var throttle = this
  this.plugin = function(request) {
    request.throttle = throttle
    // replace request.end
    request.throttled = request.end
    request.end = function() {
      var args
      args = arguments
      // this anon function will be placed in the throttle
      request.throttle.cycle(function() {
        request.throttled.apply(request, args)
      })
    }
    // attend to the throttle once we get a response
    request.on('end', function(response) {
      request.throttle._current -= 1
      request.throttle.cycle()
    })
  }
}

module.exports = Throttle
