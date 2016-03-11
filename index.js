var _ = require('underscore');

var Queue;
var instances = {};

var defaults = {
  name: 'default',
  active: true,
  rate: 40,
  ratePer: 10000,
  concurrent: 20
};

/**
 * Queue
 * The queue object. Pretty much private to this module, the exported fn returns
 * an instance method queue.plugin for use with superagent.
 *
 * @class
 * @param {string} [queueName] - identifier for queue
 * @param {object} options - key value options
 */
Queue = function(queueName, options) {
  _.extend(
    this,
    {
      // instance properties
      requestTimes: [0],
      current: 0,
      buffer: [],
      next: false
    },
    // defaults
    defaults,
    // override defaults with passed in options
    options
  );
  instances[queueName] = this;
};

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
  if (this.requestTimes.length > this.rate) {
    this.requestTimes = _.last(this.requestTimes, this.rate);
  }
  return (
    // not paused
    (this.active) &&
    // not at concurrency limit
    (this.current < this.concurrent) &&
    // less than `ratePer`
    ((Date.now() - this.requestTimes[0]) > this.ratePer) &&
    // something waiting in the queue
    (this.buffer.length)
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
 */
Queue.prototype.cycle = function(fn) {
  var queue = this;

  clearTimeout(queue.next);
  if (fn) {
    queue.buffer.push(fn);
  }

  // fire requests
  while (queue.hasCapacity()) {
    queue.buffer.shift()();
    queue.requestTimes.push(Date.now());
    queue.current += 1;
  }

  if (queue.buffer.length == 0) {
    // no more queued items
    return;
  } else if (queue.current < queue.concurrent) {
    // if bound by rate, delay
    queue.next = setTimeout(function() {
      queue.cycle();
    }, queue.ratePer - (Date.now() - queue.requestTimes[0]));
  } else {
    // waiting for a response to clear
  }
};

/**
 * plugin
 * this function is returned by the exported function. it's designed to be used
 * in a `.use` call with superagent
 *
 * @method
 * @param {Request} request - a superagent request
 */
Queue.prototype.plugin = function(request) {
  var queue = request.queue = this;

  // replace request.end
  request.queued = request.end;
  request.end = function() {
    var args;
    args = arguments;
    // this anon function will be placed in the queue
    this.queue.cycle(function() {
      request.queued.apply(request, args);
    });
  };
  // attend to the queue once we get a response
  request.on('end', function(response) {
    request.queue.current -= 1;
    request.queue.cycle();
  });
}

/**
 * module.exports
 * always returns an the plugin instance method for the specified queue. can
 * be used to configure a queue
 *
 * @method
 * @param {String} [queueName] - specify queue
 * @param {Object} options - key value options
 * @returns {Function} a function accepting a superagent request to be injected
 */
module.exports = function(queueName, options) {
  var queue;
  // deal with alternative options
  if (_.isObject(queueName)) {
    options = queueName;
    queueName = _.has(queueName, 'name') ? queueName.name : 'default';
  }
  if (!queueName) {
    queueName = 'default';
  }
  // find existing queue
  if (_.has(instances, queueName)) {
    queue = instances[queueName];
    if (options) {
      _.extend(queue, options);
      queue.cycle();
    }
  } else {
    // or create a new one
    queue = new Queue(queueName, options);
  }

  return function() {
    queue.plugin.apply(queue, arguments);
  };
};
