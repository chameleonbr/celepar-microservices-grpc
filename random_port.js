var net = require('net')

const RandomPort = (options) => {
    return new Promise((resolve, reject) => {

        if (options === undefined) {
            options = {}
        }

        Object.assign(options, {
            from: 50051,
            range: 100
        })
        let port = options.from + ~~(Math.random() * options.range)
        const server = net.createServer()
        server.listen(port, function (err) {
            server.once('close', function () {
                resolve(port)
            })
            server.close()
        })

        server.on('error', function (err) {
            RandomPort(options).then((portOk) => {
                resolve(portOk)
            })
        })
    })
}

module.exports = RandomPort