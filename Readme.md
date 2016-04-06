# superagent-throttle

  A plugin for [superagent](https://github.com/visionmedia/superagent) that
  throttles requests. Useful for rate or concurrency limited APIs.

## Features

 * This doesn't just delay requests by an arbitrary number of ms, but
   intelligently manages requests so they're sent as soon as possible whilst
   staying beneath rate limits.
 * Follows [superagent](https://github.com/visionmedia/superagent)
   `.use(throttle.plugin)` architecture
 * Hackable
 * Can use multiple instances

## Installation

Install with [npm](http://npmjs.org):

    $ npm install --save superagent-throttle

## Basic Usage

    var request = require('superagent');
    var _ = require('underscore');
    var Throttle = require('./index');

    var throttle = new Throttle({
      active: true,
      rate: 5,
      ratePer: 10000,
      concurrent: 2
    });

    _.each(_.range(1, 15), function(iteration) {
      var width = 100 + iteration;
      request
      .get('http://placekitten.com/' + width + '/100')
      .use(throttle.plugin)
      .end(function(err, res) {
        console.log(err ? err : 'retrieved ' + iteration);
      });
      console.log('added ' + iteration);
    });

## Options

 * `active`: whether or not the queue is paused.
 * `rate`: how many requests can be sent every `ratePer`
 * `ratePer`: number of ms in which `rate` requests may be sent
 * `concurrent`: how many requests can be sent concurrently

Options can be set after instantiation using the `set` method.

```javascript

    var throttle = new require('./index')({ active: false }) // start paused
    throttle.set('active', true) // unpause

```

## Advanced Usage

See [theMovieDbApi](https://github.com/leviwheatcroft/moviedb-api/blob/master/index.js)

## License

MIT Licensed
