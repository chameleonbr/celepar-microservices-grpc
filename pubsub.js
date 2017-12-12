const _ = require('lodash')
const Redis = require('ioredis')

class PubSub {
    constructor(options) {
        let def = {
            redis: {
                host: 'localhost',
                port: 6379,
                db: 10
            },
        }
        this.options = _.defaults(options, def)
        this.redis = new Redis(this.options.redis)
        this.rsub = new Redis(this.options.redis)
        this.psub = new Redis(this.options.redis)
    }

    pub(topic, obj) {
        this.redis.publish(topic, JSON.stringify(obj))
    }
    sub(config) {
        let subList = []
        for (let k in config) {
            subList.push(k)

        }
        this.rsub.subscribe(subList)
        this.rsub.on('message', (channel, message) => {
            for (let k in config) {
                if (~channel.indexOf(k)) {
                    config[k](JSON.parse(message))
                }
            }
        })

    }
    psub(config) {
        let subList = []
        for (let k in config) {
            subList.push(k)

        }
        this.psub.psubscribe(subList)
        this.psub.on('message', (pattern, channel, message) => {
            for (let k in config) {
                if (~pattern.indexOf(k)) {
                    config[k](channel, JSON.parse(message))
                }
            }
        })
    }
}
module.exports = PubSub