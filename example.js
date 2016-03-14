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
