var net = require('net')

const RandomPort = (opt) => {
    return new Promise((resolve, reject) => {

        let def = {
            from: 50051,
            range: 100
        }
        if (options === undefined) {
            options = {}
        }
        options = Object.assign({}, def, options)

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