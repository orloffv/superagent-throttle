# superagent-prefix

  A plugin for [superagent](https://github.com/visionmedia/superagent) that
  queues requests. Useful for rate or concurrency limited APIs

## warning

I've only tested this against a single API, so there's a good chance it doesn't
work. Please [post]() any issues you encounter.

## Installation

  Install with [npm](http://npmjs.org):

    $ npm install superagent-queue

## Usage

  Complicated example: [theMovieDbApi]()
  Simple example: [example.js](/example.js) (shown below)

```javascript
var request = require('superagent');
var _ = require('underscore');
var queue = require('./index');

queue({
  active: true,
  rate: 5,
  ratePer: 10000,
  concurrent: 2
});

_.each(_.range(1, 15), function(iteration) {
  var width = 100 + iteration;
  var height = 100 - iteration;
  request
  .get('http://placekitten.com/' + width + '/' + height)
  .use(queue())
  .end(function(err, res) {
    console.log(err ? err : 'retrieved ' + iteration);
  });
  console.log('queued ' + iteration);
});
```

## License

MIT Licensed
