const grpc = require('grpc')
const _ = require('lodash')
const Announcer = require('./announcer')
const protoLoader = require('@grpc/proto-loader')
const pino = require('pino')()
const rPort = require('./random_port')
const UserError = require('./user_error')
const os = require('os')
grpc.setLogger(pino)

const uncapitalizeFirstLetter = (string) => {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

const getInterfacesIP = () => {
    let addresses = []
    let ifaces = os.networkInterfaces()
    Object.keys(ifaces).forEach(function (ifname) {

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                return
            }
            addresses.push(iface.address)
        })
    })
    return addresses
}

class Server {
    constructor(options) {
        let def = {
            proto: null,
            service: null,
            package: null,
            host: null,
            bindHost: null,
            credentials: null,
            announcer: null,
            loader: {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            }
        }

        this.methods = {}
        this.options = _.defaults(options, def)
        this.options.credentials = this.options.credentials || grpc.ServerCredentials.createInsecure()


        this.options.name = this.options.package + ':' + this.options.service
        //this.proto = grpc.load(this.options.proto)
        this.proto = protoLoader.loadSync(this.options.proto, options.loader)
        this.announcer = this.options.announcer || new Announcer(this.options)
        pino.info('Creating new service')
    }
    use(obj) {
        let self = this
        let methods = Object.getOwnPropertyNames(this.proto[this.options.package + '.' + this.options.service])
        for (let mtd of methods) {
            if (obj[uncapitalizeFirstLetter(mtd)] !== undefined) {
                this.announcer.emit('service:register', mtd)
                this.methods[mtd] = (ctx, callback) => {
                    let startAt = process.hrtime()
                    this.announcer.emit('service:start', mtd)
                    obj[uncapitalizeFirstLetter(mtd)].bind(obj)(ctx).then((res) => {
                        let diff = process.hrtime(startAt)
                        let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
                        this.announcer.emit('service:end', mtd, time)
                        callback(null, res)
                    }).catch((err) => {
                        let diff = process.hrtime(startAt)
                        let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
                        this.announcer.emit('service:end', mtd, time)
                        if(!(err instanceof UserError)){
                            this.announcer.emit('service:error', mtd, err)
                        }
                        callback(err, null)
                    })
                }
            }
        }
        return this
    }
    addMethod(mtd, func) {
        let obj = {
        }
        obj[mtd] = func
        this.use(obj)
        return this
    }
    async start() {
        this.announcer.emit('starting')
        this.server = new grpc.Server()

        if (this.proto[this.options.package + '.' + this.options.service] === undefined) {
            throw new Error('package or service option not defined')
        }
        try {
            this.server.addService(this.proto[this.options.package + '.' + this.options.service], this.methods)
            let port = await rPort()
            let bindHost = this.options.bindHost || this.options.host || '0.0.0.0'
            let host = this.options.host || getInterfacesIP()[0]
            let hostPort = host + ':' + port
            let bindHostPort = bindHost + ':' + port
            this.announcer.emit('bind', hostPort)
            this.server.bind(bindHostPort, this.options.credentials)
            this.server.start()
            this.announcer.emit('started')
        } catch (err) {
            throw err
        }

        process.on('SIGINT', () => {
            pino.info('Bye')
            this.close().then(() => {
                process.exit()
            })
        });


    }
    close() {
        return new Promise((resolve, reject) => {
            this.server.tryShutdown(() => {
                this.announcer.emit('closed')
                resolve()
            })
        })

    }
}

module.exports = Server