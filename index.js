var _ = require('underscore')

var Queue;

var defaults = {
  name: 'default',
  active: true,
  rate: 40,
  ratePer: 10000,
  concurrent: 20
};

/**
 * Queue
 * The queue object.
 *
 * @class
 * @param {object} options - key value options
 */
Queue = function(options) {
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
 * queue.set('active', true)
 * queue.set({active: true})
 *
 * @method
 * @param {String|Object} options - either key value object or keyname
 * @param {Mixed} [value] - value for key
 * @returns null
 */
Queue.prototype.set = function(options, value) {
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
Queue.prototype.hasCapacity = function() {
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
    // something waiting in the queue
    (this._buffer.length)
  );
};

/**
 * cycle
 * an iterator of sorts. Should be called when
 *  - something added to queue (check if it can be sent immediately)
 *  - `ratePer` ms have elapsed since nth last call where n is `rate` (may have
 *    available rate)
 *  - some request has ended (may have available concurrency)
 *
 * @method
 * @param {Function} [fn] - a function which fires a request, use the enclosed
 *   nature of fn to store arguments et cetera
 * @returns null
 */
Queue.prototype.cycle = function(fn) {
  var queue = this;

  clearTimeout(queue._timeout);
  if (fn) {
    queue._buffer.push(fn);
  }
  // fire requests
  while (queue.hasCapacity()) {
    queue._buffer.shift()();
    queue._requestTimes.push(Date.now());
    queue._current += 1;
  }


  if (
    // if:
    //  - no more queued items
    //  - paused
    //  - waiting for concurrency
    // then: do nothing, cycle will be called again when these states change.
    (queue._buffer.length == 0) ||
    (!queue.active) ||
    (queue._current >= queue.concurrent)
  ) {
    return
  } else if (
    // if:
    //  - limited by rate
    // then:
    //  - a timer must be set
    (queue._current < queue.concurrent)
  ) {
    queue._timeout = setTimeout(function() {
      queue.cycle();
    }, queue.ratePer - (Date.now() - queue._requestTimes[0]));
  }
};

/**
 * bindPlugin
 * create an instance method called `plugin` it needs an enclosure like this to
 * store a reference to the queue, otherwise the plugin, when called by
 * superagent, will have no reference to itself.
 * this should be called by the class constructor
 *
 * `superagent` `use` function should refer to this plugin method a la
 * `.use(queue.plugin)`
 *
 * @method
 * @returns null
 */
Queue.prototype.bindPlugin = function() {
  var queue = this
  this.plugin = function(request) {
    request.queue = queue
    // replace request.end
    request.queued = request.end
    request.end = function() {
      var args
      args = arguments
      // this anon function will be placed in the queue
      request.queue.cycle(function() {
        request.queued.apply(request, args)
      })
    }
    // attend to the queue once we get a response
    request.on('end', function(response) {
      request.queue._current -= 1
      request.queue.cycle()
    })
  }
}

module.exports = Queue
