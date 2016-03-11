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

