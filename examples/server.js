delete process.env['HTTP_PROXY']
delete process.env['http_proxy']
delete process.env['HTTPS_PROXY']
delete process.env['https_proxy']

const {
    Server
} = require('../index')
const UserError = require('../index').UserError

const serv = new Server({
    package: 'helloworld',
    service: 'Greeter',
    proto: __dirname + '/hello.proto'
})

let obj = {
    sayHello: async (ctx) => {
            console.log('SayHello')
            return {
                message: 'Hello ' + ctx.request.name + ' ' + Date.now()
            }
        },
        sayBye: (ctx) => {
            return new Promise((resolve, reject) => {
                console.log('SayByeStart')
                setTimeout(() => {
                    console.log('SayByeEnd')
                    resolve({
                        message: 'Hello ' + ctx.request.name + ' ' + Date.now()
                    })
                },600000)
            })
        }
}

class Test {
    sayHello(ctx) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('SayHello')
                let date = Date.now()
                if (date % 2) { // testing errors from internal code and not connections
                    reject(new Error('Test Error'))

                    /*resolve({
                        message: 'Hello ' + ctx.request.name + ' ' +  date
                    })*/
                } else {
                    resolve({
                        message: 'Hello ' + ctx.request.name + ' ' + date
                    })
                }
            }, Math.floor((Math.random() * 100) + 1))

        })
    }
    async sayBye(ctx) {
        //throw new Error('lalalala')
        console.log('SayBye')
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now()
        }
    }
}
//let inst = new Test()

serv.use(obj)

serv.start()