const {
    Server
} = require('../index')

const serv = new Server({
    package: 'helloworld',
    service: 'Greeter',
    proto: __dirname + '/hello.proto'
})

let obj = {
    SayHello: async(ctx) => {
        console.log('SayHello')
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    },
    SayBye: async(ctx) => {
        console.log('SayBye')
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    }
}

class Test {
    SayHello(ctx) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                console.log('SayHello')
                resolve({
                    message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
                })
            }, Math.floor((Math.random() * 100) + 1))

        })
    }
    async SayBye(ctx) {
        //throw new Error('lalalala')
        console.log('SayBye')
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    }
}
let inst = new Test()

console.log(typeof inst)

serv.use(inst)

serv.start()