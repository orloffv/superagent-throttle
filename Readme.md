# superagent-queue

  A plugin for [superagent](https://github.com/visionmedia/superagent) that
  queues requests. Useful for rate or concurrency limited APIs.

## Installation

  Install with [npm](http://npmjs.org):

    $ npm install superagent-queue

## Basic Usage

    var request = require('superagent');
    var _ = require('underscore');
    var Queue = require('./index');

    var queue = new Queue({
      active: true,
      rate: 5,
      ratePer: 10000,
      concurrent: 2
    });

    _.each(_.range(1, 15), function(iteration) {
      var width = 100 + iteration;
      request
      .get('http://placekitten.com/' + width + '/100')
      .use(queue.plugin)
      .end(function(err, res) {
        console.log(err ? err : 'retrieved ' + iteration);
      });
      console.log('queued ' + iteration);
    });

## Advanced Usage

See [theMovieDbApi](https://github.com/leviwheatcroft/themoviedbapi/blob/master/index.js)

## License

MIT Licensed
