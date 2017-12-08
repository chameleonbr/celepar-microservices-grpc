const grpc = require('grpc')
const _ = require('lodash')
const Announcer = require('./announcer')
const pino = require('pino')()
const portFinder = require('portfinder')
portFinder.basePort = 50051
const os = require('os')

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
            announcer: null
        }

        this.methods = {}
        this.options = _.defaults(options, def)

        this.options.name = this.options.package + ':' + this.options.service
        this.announcer = this.options.announcer || new Announcer(this.options)
        pino.info('Creating new service')
    }
    use(obj) {
        let self = this
        let methods = Object.getOwnPropertyNames(obj)
        if (methods.length === 0) {
            methods = Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).slice(1)
        }
        for (let mtd of methods) {
            this.announcer.emit('service:register', mtd)
            this.methods[mtd] = (ctx, callback) => {
                let startAt = process.hrtime()
                this.announcer.emit('service:start', mtd)
                obj[mtd].bind(obj)(ctx).then((res) => {
                    let diff = process.hrtime(startAt)
                    let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
                    this.announcer.emit('service:end', mtd, time)
                    callback(null, res)
                }).catch((err) => {
                    let diff = process.hrtime(startAt)
                    let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
                    this.announcer.emit('service:end', mtd, time)
                    this.announcer.emit('service:error', mtd, err)
                    callback(err, null)
                })
            }
        }
        return this
    }
    addMethod(mtd, func) {
        this.use({
            mtd: func
        })
        return this
    }
    async start() {
        this.announcer.emit('starting')
        this.server = new grpc.Server()
        let proto = grpc.load(this.options.proto)
        if (proto[this.options.package] === undefined) {
            throw new Error('package option not defined')
        }
        if (proto[this.options.package][this.options.service] === undefined) {
            throw new Error('service option not defined')
        }
        try {
            this.server.addService(proto[this.options.package][this.options.service]['service'], this.methods)
            let port = await portFinder.getPortPromise()
            let bindHost = this.options.bindHost || this.options.host || '0.0.0.0'
            let host = this.options.host || getInterfacesIP()[0]
            let hostPort = host + ':' + port
            let bindHostPort = bindHost + ':' + port
            this.announcer.emit('bind', hostPort)
            this.server.bind(bindHostPort, this.options.credentials || grpc.ServerCredentials.createInsecure())
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