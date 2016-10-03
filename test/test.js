'use strict'
const request       = require('superagent')
const _             = require('lodash')
const assert        = require('chai').assert
const Throttle      = require('../index')
const http          = require('http')
require('mocha-jshint')({
  paths: [
    'index.js'
  ]
})

let log
let max
let mockServer
let respond

mockServer = (delay, jitter) => {
  return http.createServer(
    (request, response) => {
      if (!delay && !jitter) return respond(response)
      setTimeout(
        respond,
        Math.floor((Math.random() * jitter) + delay)
      )
    }
  ).listen(3003)
}

respond = (response) => {
  response.writeHead(200)
  response.end()
}

log = function(prefix) {
  let count = 0
  let start = Date.now()
  return (request) => {
    let rate
    let check = new Date(Date.now() - request.throttle.ratePer)
    rate = request.throttle._requestTimes.length - 1 - _.findLastIndex(
      request.throttle._requestTimes,
      (date) => (date < check)
    )
    count += 1
    console.log([
      '| ',
      _.padEnd(prefix, 10, ' '),
      '| ',
      _.padStart(count, 3, ' '),
      ' | ',
      _.padStart(Date.now() - start, 6, ' '),
      ' | conc: ',
      _.padStart(request.throttle._current, 3, ' '),
      ' | rate: ',
      _.padStart(rate, 3, ' '),
      ' | queued: ',
      _.padStart(request.throttle._buffer.length, 3, ' '),
      ' |'
    ].join(''))
  }
}

max = function() {
  let count = 0
  let maxRate = 0
  let maxConcurrent = 0
  let maxBuffer = 0
  let start = Date.now()
  return (request) => {
    if (request) {
      let rate
      let check = new Date(Date.now() - request.throttle.ratePer)
      rate = request.throttle._requestTimes.length - 1 - _.findLastIndex(
        request.throttle._requestTimes,
        (date) => (date < check)
      )
      count += 1
      if (maxConcurrent < request.throttle._current)
        maxConcurrent = request.throttle._current
      if (maxRate < rate)
        maxRate = rate
      if (maxBuffer < request.throttle._buffer.length)
        maxBuffer = request.throttle._buffer.length
    }
    return {
      count,
      maxRate,
      maxConcurrent,
      maxBuffer
    }
  }
}

describe('throttle', () => {

  it('should work with low concurrency', (done) => {
    let server = mockServer()
    let highest = max()
    let throttle = new Throttle({
      active: true,
      rate: 1000,
      ratePer: 2000,
      concurrent: 2
    })
    throttle.on('sent', highest)
    throttle.on('received', highest)
    // throttle.on('sent', log('sent'))
    // throttle.on('received', log('rcvd'))


    _.times(100, function(idx) {
      request
      .get('http://localhost:3003')
      .use(throttle.plugin())
      .end()
    })

    throttle.on('drained', () => {
      let result = highest()
      assert(result.maxConcurrent == 2, 'highest concurrency was 2')
      server.close()
      done()
    })
  })

  it('should work with low rate', (done) => {
    let server = mockServer()
    let highest = max()
    let throttle = new Throttle({
      active: true,
      rate: 2,
      ratePer: 1000,
      concurrent: 2
    })
    throttle.on('sent', highest)
    throttle.on('received', highest)
    // throttle.on('sent', log('sent'))
    // throttle.on('received', log('rcvd'))


    _.times(10, function(idx) {
      request
      .get('http://localhost:3003')
      .use(throttle.plugin())
      .end()
    })

    throttle.on('drained', () => {
      let result = highest()
      assert(result.maxRate == 2, 'highest rate was 2')
      server.close()
      done()
    })
  })

  it('should work when resource bound (issue #6)', (done) => {
    let server = mockServer()
    let highest = max()
    let throttle = new Throttle({
      active: true,
      rate: 1000,
      ratePer: 5000,
      concurrent: 1000
    })
    throttle.on('sent', highest)
    throttle.on('received', highest)
    // throttle.on('sent', log('sent'))
    // throttle.on('received', log('rcvd'))


    _.times(1000, function(idx) {
      request
      .get('http://localhost:3003')
      .use(throttle.plugin())
      .end()
    })

    throttle.on('drained', () => {
      let result = highest()
      assert.isOk(true, 'has thrown error?')
      server.close()
      done()
    })
  })

  it ('should not break end handler (issue #5)', (done) => {
    let server = mockServer()
    let throttle = new Throttle()

    request
    .get('http://localhost:3003')
    .use(throttle.plugin())
    .end(() => {
      assert.isOk(true, 'end handler not working?')
      server.close()
      done()
    })
  })

  it ('should return superagent instance (issue #2)', () => {
    let server = mockServer()
    let throttle = new Throttle()

    let instance = request.get('http://localhost:3003')
    let returned = instance.use(throttle.plugin())
    assert(instance === returned, 'instance not returned')
  })
})



