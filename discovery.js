const grpc = require('grpc')
const EventEmitter = require('events')
const _ = require('lodash')
const Redis = require('ioredis')
const rr = require('rr')
const pino = require('pino')()

class Discovery extends EventEmitter {
    constructor(options) {
        super()
        let def = {
            redis: {
                host: 'localhost',
                port: 6379,
                db: 10
            },
            error_limit: 0.15
        }
        this.options = _.defaults(options, def)
        this.redis = new Redis(this.options.redis)
        this.listServers = {}
        this.listConnections = {}
        this.listInfo = {}
        this.serverFound = false
        this.rsub = new Redis(this.options.redis)
    }
    start(daemon = false) {
        let self = this
        return new Promise((resolve, reject) => {
            let subs = []
            let pipe = this.redis.pipeline()
            for (let id of this.options.ids) {
                subs.push('svc:up:' + id)
                subs.push('svc:down:' + id)
                pipe.publish('svc:ping:' + id, 1)
                this.listServers[id] = []
                this.listConnections[id] = {}
            }

            this.rsub.subscribe(subs, () => {
                pino.info('ping sended')
                pipe.exec()
            })
            this.rsub.on('message', (channel, message) => {
                if (~channel.indexOf("svc:up:")) {
                    let svc = channel.split(':')[2]
                    let [host, timestamp, ttl, qty, avg, queue, errors] = message.split('|')
                    this.setInfo(svc, host, {
                        host,
                        timestamp,
                        ttl,
                        qty,
                        avg,
                        queue,
                        errors
                    })

                }
                if (~channel.indexOf("svc:down:")) {
                    let svc = channel.split(':')[2]
                    let host = message
                    this.del(svc, host)
                }
            })

            let ref = setInterval(() => {
                pino.info('awaiting servers')
                if (self.serverFound || daemon === true) {
                    if (self.serverFound) {
                        pino.info('server found, starting...')
                    }
                    clearInterval(ref)
                    self.started = true
                    resolve(self)
                }
            }, 1000)
        })
    }
    setInfo(svc, host, info) {
        if (this.listInfo[svc] === undefined) {
            this.listInfo[svc] = {}
        }
        if (this.listInfo[svc][host] === undefined) {
            this.listInfo[svc][host] = {}
        }
        this.listInfo[svc][host] = info

        if (this.listInfo[svc][host]['errors'] > 0) {
            if ((this.listInfo[svc][host]['qty'] * this.options.error_limit) > this.listInfo[svc][host]['errors']) {
                this.add(svc, host)
            } else {
                this.del(svc, host)
            }
        } else {
            this.add(svc, host)
        }

    }
    clean(svc, host) {
        this.del(svc, host)
        this.redis.publish('svc.down:' + svc, host)
    }
    add(id, host) {
        this.serverFound = true
        if (this.listServers[id].indexOf(host) === -1) {
            pino.info("ADD SERVER", id, host)
            this.listServers[id].push(host)
        }
    }
    del(id, host) {
        let i = this.listServers[id].indexOf(host)

        if (i !== -1) {
            pino.info("DEL SERVER", id, host)
            this.listServers[id].splice(i, 1)
        }

        if (this.listConnections[id][host] !== undefined) {
            this.listConnections[id][host].close()
            delete this.listConnections[id][host]
        }

        if (this.listInfo[id] !== undefined && this.listInfo[id][host] !== undefined) {
            delete this.listConnections[id][host]
        }
    }
    getClient(svc, id, forceHost = false) {
        if (this.listServers[id] !== undefined && this.listServers[id].length > 0) {
            let host
            if (!!forceHost) {
                host = forceHost
            } else {
                host = rr(this.listServers[id])
            }
            try {
                if (this.listConnections[id][host] === undefined) {
                    this.listConnections[id][host] = new svc(host, (this.options.credentials || grpc.credentials.createInsecure()))
                }

                if (!this.listConnections[id][host]) {
                    throw new Error('No available service found')
                }

                return [host, this.listConnections[id][host]]
            } catch (e) {
                throw e
            }
        } else {
            throw new Error('No available service found')
        }
    }
}

module.exports = Discovery