const Server = require('./server')
const Client = require('./client')

exports['server'] = Server
exports['client'] = Client

module.exports = {
    Server:Server,
    Client:Client
}
