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
                    let [host, timestamp, ttl, qty, avg, queue, errors, ...mtds] = message.split('|')

                    let methods = {}
                    for (let mtd of mtds) {
                        let [mtdM, qtyM, avgM, queueM, errorsM] = mtd.split('!')
                        methods[mtdM] = {
                            qty: qtyM,
                            avg: avgM,
                            queue: queueM,
                            errors: errorsM
                        }

                    }

                    this.setInfo(svc, host, {
                        host,
                        timestamp,
                        ttl,
                        qty,
                        avg,
                        queue,
                        errors,
                        methods
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

        this.add(svc, host)
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
    getClient(svc, id, mtd, forceHost) {
        if (this.listServers[id] !== undefined && this.listServers[id].length > 0) {
            let host = this.selectHost(svc, id, mtd, forceHost)
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
    selectHost(svc, id, mtd, forceHost = false, retries = 0) {
        let host
        if (!!forceHost) {
            host = forceHost
        } else {
            host = rr(this.listServers[id])
        }
        if (this.listServers[id].length > 1 && listInfo[svc][host]['methods'][mtd]['errors'] > 0 && retries < 5) {
            if ( listInfo[svc][host]['methods'][mtd]['errors'] > (this.listInfo[svc][host]['methods'][mtd]['qty'] * this.options.error_limit)) {
                retries++
                host = this.selectHost(svc, id, mtd, forceHost, retries)
            }
        }
        return host
    }
}

module.exports = Discovery