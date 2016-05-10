'use strict'
const request       = require('superagent')
const _             = require('lodash')
const Throttle      = require('../index')
var test = require('unit.js')
//Before tests
var mock = require('superagent-mocker')(request)

mock.timeout = function() {
  return Math.floor(Math.random() * 2000)
}
mock.timeout = 500
var throttle = new Throttle({
  // start unpaused
  active: true,
  // send max 5 requests every `ratePer` ms
  rate: 5,
  // send max `rate` requests every 10000 ms
  ratePer: 6000,
  // max 2 requests should run concurrently
  concurrent: 3
})

mock.get('/normal/:id', function(req) {
  return {
    id: req.params.id,
    content: 'normal',
    headers: req.headers
  };
});
mock.get('/serial/:id', function(req) {
  return {
    id: req.params.id,
    content: 'serial',
    headers: req.headers
  };
});

mock.timeout = 500
_.each(_.range(10), function(count) {
  request
  .get('/normal/' + count)
  .use(throttle.plugin())
  .end(function(err, data) {
    console.log(data)
  })
})
mock.timeout = 1000
_.each(_.range(10), function(count) {
  request
  .get('/serial/' + count)
  .use(throttle.plugin('test'))
  .end(function(err, data) {
    console.log(data)
  })
})

