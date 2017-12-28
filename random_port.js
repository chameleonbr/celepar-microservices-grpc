var net = require('net')

const RandomPort = (opt) => {
    return new Promise((resolve, reject) => {

        let def = {
            from: 50051,
            range: 100
        }
        if (opt === undefined) {
            opt = {}
        }
        let options = Object.assign({}, def, opt)

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