const PubSub = require('../pubsub')

let pusub = new PubSub()

pusub.sub({
    'event': (msg) => {
        console.log(msg)
    },
    'obj': (obj) => {
        console.log(obj)
    }
})

setTimeout(() => {
    pusub.pub('event', 'hello')
    pusub.pub('obj', {
        test: 123
    })
}, 2000)