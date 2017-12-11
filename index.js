const Server = require('./server')
const Client = require('./client')
const grpc = require('grpc')

exports['server'] = Server
exports['client'] = Client
exports['grpc'] = grpc

module.exports = {
    Server: Server,
    Client: Client,
    grpc: grpc
}