# superagent-throttle

  A plugin for [superagent](https://github.com/visionmedia/superagent) that
  throttles requests. Useful for rate or concurrency limited APIs.

## Features

 * This doesn't just deley requests by an arbitrary number of ms, but
   intelligently manages requests so they're sent as soon as possible whilst
   staying beneath rate limits.
 * Follows [superagent](https://github.com/visionmedia/superagent)
   `.use(throttle.plugin)` architecture
 * Hackable
 * Can use multiple instances

## Installation

Install with [npm](http://npmjs.org):

    $ npm install superagent-throttle

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
      console.log('throttled ' + iteration);
    });

## Advanced Usage

See [theMovieDbApi](https://github.com/leviwheatcroft/moviedb-api/blob/master/index.js)

## License

MIT Licensed
