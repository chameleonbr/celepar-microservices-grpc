const {
    Client
} = require('../index')

let cli = new Client({
    services: [{
        package: 'helloworld',
        service: 'Greeter',
    }],
    proto: __dirname + '/hello.proto'
})




let exec = async() => {
    try {
        let res = await cli.sayHello({
            name: 'Avila'
        })
        console.log(res)
    } catch (err) {
        console.log('errou', err)
    }
}

let exec2 = async() => {
    try {
        let res = await cli.helloworld.Greeter.sayHello({
            name: 'Avila'
        })
    } catch (err) {
        console.log('errou', err)
    }
}

let exec3 = () => {
    for (let i = 0; i < 100000; i++) {
        exec2()
    }
}
/*

cli.start().then(() => {
    setInterval(async() => {
        let res = await cli.helloworld.Greeter.sayHello('avila')
        console.log(res)
    }, 1000)
})
*/



cli.start().then(async(client) => {
    let startAt = process.hrtime()
    for (let i = 0; i < 5000; i++) {
        try {
            let res = await client.helloworld.Greeter.sayBye('avila')
            //console.log(res)
        } catch (e) {
            //console.log(e)
        }
    }
    let diff = process.hrtime(startAt)
    let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
    console.log(time)
})