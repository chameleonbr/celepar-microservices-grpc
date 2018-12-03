# celepar-microservices-grpc
Basic Microservices lib, working with gRPC and Redis.

The idea is take advantage of Redis pub/sub and sets to find available servers and connect directly to them.
If you add more services, it will be detected automatically and client will call them.
If one or more service fall, the client will try to another.



server.js
```javascript
const { Server } = require('celepar-microservices-grpc')

const srv = new Server({
    package: 'helloworld',
    service: 'Greeter', // You could make diferent services from the same proto file
    proto: __dirname + '/hello.proto',
    redis: {
        host: 'localhost',
        port: 6379,
        db: 10
    }
})

let obj = {
    SayHello: async(ctx) => {
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    },
    SayBye: async(ctx) => {
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    }
}
// OR

class Test {
    SayHello(ctx) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve({
                    message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
                })
            }, Math.floor((Math.random() * 100) + 1)) // random response time

        })
    }
    async SayBye(ctx) {
        return {
            message: 'Hello ' + ctx.request.name + ' ' + Date.now() 
        }
    }
}

srv.use(new Test()).start()
```


client.js
```javascript

const { Client } = require('celepar-microservices-grpc')

let cli = new Client({
    services: [{ // You could add more services from the same proto file
        package: 'helloworld',
        service: 'Greeter',
    }],
    proto: __dirname + '/hello.proto',
    redis: {
        host: 'localhost',
        port: 6379,
        db: 10
    }
}).start()

let test = async() => {
    try {
        let res = await cli.helloworld.Greeter.sayHello({
            name: 'World'
        })
        console.log(res)
    } catch (err) {
        console.log('error', err)
    }
}
test()
```
