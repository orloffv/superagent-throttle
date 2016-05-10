'use strict'
const request       = require('superagent')
const _             = require('lodash')
const Throttle      = require('./index')

// create throttle instance
let throttle = new Throttle({
  // start unpaused
  active: true,
  // send max 5 requests every `ratePer` ms
  rate: 5,
  // send max `rate` requests every 10000 ms
  ratePer: 10000,
  // max 2 requests should run concurrently
  concurrent: 4
})

_.each(_.range(1, 10), function(iteration) {
  var width = 100 + iteration
  request
  .get('http://placekitten.com/' + width + '/100')
  .use(throttle.plugin('test'))
  .end(function(err, res) {
    console.log(err ? err : 'serial ' + iteration)
  })
  console.log('added ' + iteration)
})
_.each(_.range(1, 15), function(iteration) {
  var width = 100 + iteration
  request
  .get('http://placekitten.com/' + width + '/100')
  .use(throttle.plugin())
  .end(function(err, res) {
    console.log(err ? err : 'retrieved ' + iteration)
  })
  console.log('added ' + iteration)
})

