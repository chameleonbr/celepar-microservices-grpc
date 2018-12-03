delete process.env['HTTP_PROXY']
delete process.env['http_proxy']
delete process.env['HTTPS_PROXY']
delete process.env['https_proxy']

const {
    Client
} = require('../index')

let cli = new Client({
    services: [{
            package: 'helloworld',
            service: 'Greeter',
        },
        {
            package: 'helloworld',
            service: 'Other',
        }
    ],
    proto: __dirname + '/hello.proto'
})


cli.start().then(async (client) => {
    let exec = async () => {
        try {

            for (let i = 0; i < 210; i++) {
                let res1 = await cli.helloworld.Greeter.sayHello('avila')
                console.log(res1)
            }
            
            cli.options.callOptions = {
                deadline: new Date().setSeconds(new Date().getSeconds() + 10)
            }
            let res = await cli.helloworld.Greeter.sayBye('avila')
            console.log(res)
        } catch (err) {
            console.log('errou', err)
        }
    }
    exec()
})

/*
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

cli.start(true).then(() => {
    setInterval(async() => {
        let res = await cli.helloworld.Greeter.sayHello('avila')
        console.log(res)
    }, 1000)
})
*/
/*

cli.start().then(async(client) => {
    let startAt = process.hrtime()
    for (let i = 0; i < 5000; i++) {
        try {
            let res = await cli.helloworld.Greeter.sayBye('avila')
            console.log(res)
        } catch (e) {
            console.log(e)
        }
    }
    let diff = process.hrtime(startAt)
    let time = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
    console.log(time)
})*/