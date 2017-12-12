const EventEmitter = require('events')
const _ = require('lodash')
const Redis = require('ioredis')
const crypto = require('crypto')

const FixedQueue = require('fixedqueue').FixedQueue

const pino = require('pino')()

class Announce extends EventEmitter {
    constructor(options) {
        super()
        let self = this
        let def = {
            redis: {
                host: 'localhost',
                port: 6379,
                db: 10
            },
            update: 5000,
            multiplier: 1.5,
            name: null,
            freq: 100,
            count: 1000
        }
        this.options = _.defaults(options, def)
        if (!this.options.name) {
            throw new Error('Name must be defined')
        }
        this.id = crypto.createHash('md5').update(this.options.name).digest('hex')
        this.hostPort = ''
        this.avg = 0
        this.queue = 0
        this.errors = 0
        this.queueReq = new FixedQueue(this.options.count)
        this.it = 0
        this.redis = new Redis(this.options.redis)
        this.rsub = new Redis(this.options.redis)

        this.on('starting', () => {
            pino.info('starting', this.id)
        })
        this.on('bind', (hostPort) => {
            this.hostPort = hostPort
            pino.info('bind', hostPort)
            this.rsub.subscribe('svc:ping:' + this.id)
            this.rsub.on('message', (channel, message) => {
                pino.info('ping received')
                this.redis.publish('svc:pong:' + this.id, hostPort)
            })
        })
        this.on('started', () => {
            this.update.call(self)
            this.timer = setInterval(this.update.bind(self), this.options.update)
        })
        this.on('closed', () => {
            pino.info('shutdown service')
            this.redis.publish('svc:down:' + this.id, this.hostPort)
            clearInterval(this.timer)
        })
        this.on('service:register', (method) => {
            pino.info('Registering method', method)
        })
        this.on('service:start', (method) => {
            this.queue++
        })
        this.on('service:end', (method, time) => {
            this.queue--
                this.it++
                this.queueReq.push(time)

            if (this.it === this.options.freq) {
                this.it = 0
                this.avg = Math.round(this.queueReq.reduce(function (tot, cur) {
                    return tot + cur
                }, 0) / this.queueReq.length)
            }
        })
        this.on('service:error', (method) => {
            this.errors++
        })
    }
    update() {
        this.redis.publish('svc:up:' + this.id, this.hostPort + '|' + Date.now() + '|' + (this.options.update * this.options.multiplier) + '|' + this.avg + '|' + this.queue + '|' + this.errors)
    }
}

module.exports = Announce