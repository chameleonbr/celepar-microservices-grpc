const grpc = require('grpc')
const _ = require('lodash')
const Discovery = require('./discovery')
const protoLoader = require('@grpc/proto-loader')
const crypto = require('crypto')
const pino = require('pino')()
const async = require('async')
grpc.setLogger(pino)

const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const uncapitalizeFirstLetter = (string) => {
    return string.charAt(0).toLowerCase() + string.slice(1);
}



class Client {
    constructor(options) {
        let def = {
            proto: null,
            services: [], // {package:"",service:""}
            ids: [],
            host: null,
            credentials: null,
            retries: 3,
            error_limit: 0.15,
            loader: {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            },
            callOptions: {

            }
        }
        this.methods = {}
        this.pool = {}
        this.options = _.defaults(options, def)
        //let proto = grpc.load(this.options.proto)
        let proto = protoLoader.loadSync(this.options.proto, options.loader)
        this.discovery = this.options.discovery || new Discovery(this.options)

        for (let service of this.options.services) {
            let svcDef = proto[service.package + '.' + service.service]
            let id = crypto.createHash('md5').update(service.package + ':' + service.service).digest('hex')
            this.options.ids.push(id)
            let methods = Object.getOwnPropertyNames(svcDef)
            if(this[service.package] === undefined){
                this[service.package] = {}
            }
            this[service.package][service.service] = {}
            for (let mtd of methods) {
                this[service.package][service.service][uncapitalizeFirstLetter(mtd)] = (msg) => {
                    return new Promise((resolve, reject) => {
                        let retry = this.options.retries
                        let resOk = false

                        async.until(() => {
                                return resOk
                            },
                            (callback) => {
                                try {
                                    let svc = grpc.loadPackageDefinition(proto)[service.package][service.service]
                                    let [host, serviceInstance] = this.getClient(svc, id, mtd, this.options.host)
                                    if (serviceInstance) {
                                        serviceInstance[mtd](msg, this.options.callOptions, (err, res) => {
                                            if (retry > 0) {
                                                if (err) {
                                                    retry--;
                                                    pino.error('exception', err)
                                                    if (err.code != 13 && err.code >= 8 && err.code <= 15) {
                                                        pino.error('reconnecting...', id, err)
                                                        this.discovery.clean(id, host)
                                                        callback(null)
                                                    } else {
                                                        callback(err)
                                                    }
                                                } else {
                                                    resOk = true
                                                    callback(null, res)
                                                }
                                            } else {
                                                resOk = true
                                                callback(new Error('Max retries reached'))
                                            }
                                        })
                                    } else {
                                        callback(new Error('Fail to find service up'))
                                    }

                                } catch (e) {
                                    reject(e)
                                }
                            },
                            (err, res) => {
                                if (!err) {
                                    resolve(res)
                                } else {
                                    reject(err)
                                }
                            }
                        )
                    })
                }
            }
        }
        
    }

    async start(daemon = false) {
        await this.discovery.start(daemon)
        return this
    }

    getClient(svc, id, mtd, host) {
        try {
            return this.discovery.getClient(svc, id, mtd, host)
        } catch (e) {
            throw e
        }
    }


}
module.exports = Client
