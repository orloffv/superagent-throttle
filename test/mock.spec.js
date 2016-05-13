'use strict'
const request       = require('superagent')
const _             = require('lodash')
const Throttle      = require('../index')
var test            = require('unit.js')

var throttle = new Throttle({
  // start unpaused
  active: true,
  // send max 5 requests every `ratePer` ms
  rate: 10,
  // send max `rate` requests every 10000 ms
  ratePer: 6000,
  // max 2 requests should run concurrently
  concurrent: 3
})

_.times(10, function(idx) {
  request
  .get('http://jsonplaceholder.typicode.com/posts')
  .use(throttle.plugin('test'))
  .end(function(err, data) {
    console.log('serial: ' + idx)
  })
})
_.times(10, function(idx) {
  request
  .get('http://jsonplaceholder.typicode.com/posts')
  .use(throttle.plugin())
  .end(function(err, data) {
    console.log('normal: ' + idx)
  })
})


