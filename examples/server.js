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
                let date = Date.now()
                if(date %2){ // testing errors from internal code and not connections
                    reject(new Error('Test Error'))

                    /*resolve({
                        message: 'Hello ' + ctx.request.name + ' ' +  date
                    })*/
                }else{
                    resolve({
                        message: 'Hello ' + ctx.request.name + ' ' +  date
                    })
                }
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