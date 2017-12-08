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
            count: 1000,
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


        /**
         * KEYS[1] Service MD5
         * ARGV[1] HOST:PORT
         */

        this.redis.defineCommand('bindService', {
            numberOfKeys: 1,
            lua: `
            local oldService = redis.call('GET','HSI:'..ARGV[1])        
            if oldService ~= false then
                redis.call('srem','SVC:'..oldService, ARGV[1])
                redis.call('del','HSI:'..ARGV[1])
                redis.call('publish','svc:down:'..oldService,ARGV[1])
            end
            redis.call('sadd','SVC:'..KEYS[1], ARGV[1])
            `
        })

        /**
         * KEYS[1] SVC
         * KEYS[2] HOST:PORT
         * KEYS[3] TIMESTAMP
         * KEYS[4] TTL
         * ARGV[1] AVG
         * ARGV[2] REQ QUEUE
         * ARGV[3] ERRORS
         */

        this.redis.defineCommand('upService', {
            numberOfKeys: 4,
            lua: `
            redis.call('publish','svc:up:'..KEYS[1],KEYS[2]..':'..KEYS[3]..':'..KEYS[4]..':'..ARGV[1]..':'..ARGV[2]..':'..ARGV[3])
            redis.call('psetex','HSI:'..KEYS[2], KEYS[4], KEYS[1])
            redis.call('sadd','SVC:'..KEYS[1], KEYS[2])
            `
        })

        this.on('starting', () => {
            pino.info('starting', this.id)
        })
        this.on('bind', (hostPort) => {
            this.redis.bindService(this.id, hostPort)
            this.hostPort = hostPort
            pino.info('bind', hostPort)
        })
        this.on('started', () => {
            this.update.call(self)
            this.timer = setInterval(this.update.bind(self), this.options.update)
        })
        this.on('closed', () => {
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
            this.queue--;
            /*this.it++;
            this.queueReq.push(time)

            if (this.it === this.options.freq) {
                this.it = 0
                this.avg = Math.round(this.queueReq.reduce(function (tot, cur) {
                    return tot + cur;
                }, 0) / this.queueReq.length)
            }*/
        })
        this.on('service:error', (method) => {
            this.errors++
        })

    }
    update() {
        this.redis.upService(this.id,this.hostPort,Date.now(),(this.options.update * this.options.multiplier),this.avg,this.queue,this.errors)
    }
}

module.exports = Announce