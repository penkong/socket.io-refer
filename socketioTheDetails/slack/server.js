const express = require('express')
const socketio = require('socket.io')
const namespaces = require('./src/data/namespaces')
// console.log(namespaces[0]);

const app = express()

app.use(express.static(__dirname + '/public'))

const expressServer = app.listen(9000)

const io = socketio(expressServer)

// ------------

// connection to main namespace

// on first connection we send info of all valid names spaces for user.

io.on('connection', socket => {
  // console.log(socket.handshake)

  // build an array to send back with the img and endpoing for each NS

  let nsData = namespaces.map(ns => ({
    img: ns.img,
    endpoint: ns.endpoint
  }))

  // console.log(nsData)

  // sned the nsData back to the client. We need to use socket, NOT io, because we want it to

  // go to just this client.

  socket.emit('nsList', nsData)
})

// ------------

// loop through each namespace and listen for a connection

namespaces.forEach(ns => {
  // console.log(namespace)

  const thisNs = io.of(ns.endpoint)

  thisNs.on('connection', nsSocket => {
    console.log(nsSocket.handshake)

    const username = nsSocket.handshake.query.username

    // console.log(`${nsSocket.id} has join ${namespace.endpoint}`)
    // a socket has connected to one of our chatgroup namespaces.
    // send that ns gorup info back

    nsSocket.emit('nsRoomLoad', ns.rooms)

    nsSocket.on('joinRoom', (roomToJoin, numberOfUsersCallback) => {
      // deal with history... once we have it

      console.log(nsSocket.rooms)

      const roomToLeave = Object.keys(nsSocket.rooms)[1]

      nsSocket.leave(roomToLeave)

      updateUsersInRoom(ns, roomToLeave)

      nsSocket.join(roomToJoin)

      // io.of('/wiki').in(roomToJoin).clients((error, clients)=>{
      //     console.log(clients.length)
      //     numberOfUsersCallback(clients.length);
      // })

      const nsRoom = ns.rooms.find(room => room.roomTitle === roomToJoin)

      nsSocket.emit('historyCatchUp', nsRoom.history)

      updateUsersInRoom(ns, roomToJoin)
    })
    nsSocket.on('newMessageToServer', msg => {
      const fullMsg = {
        text: msg.text,
        time: Date.now(),
        username: username,
        avatar: 'https://via.placeholder.com/30'
      }

      // console.log(fullMsg)
      // Send this message to ALL the sockets that are in the room that THIS socket is in.
      // how can we find out what rooms THIS socket is in?
      // console.log(nsSocket.rooms)
      // the user will be in the 2nd room in the object list
      // this is because the socket ALWAYS joins its own room on connection
      // get the keys

      const roomTitle = Object.keys(nsSocket.rooms)[1]

      // we need to find the Room object for this room

      const nsRoom = ns.rooms.find(room => room.roomTitle === roomTitle)

      // console.log("The room object that we made that matches this NS room is...")
      // console.log(nsRoom)

      nsRoom.addMessage(fullMsg)

      io.of(ns.endpoint).to(roomTitle).emit('messageToClients', fullMsg)
    })
  })
})

function updateUsersInRoom(namespace, roomToJoin) {
  // Send back the number of users in this room to ALL sockets connected to this room
  io.of(namespace.endpoint)
    .in(roomToJoin)
    .clients((error, clients) => {
      // console.log(`There are ${clients.length} in this room`);
      io.of(namespace.endpoint)
        .in(roomToJoin)
        .emit('updateMembers', clients.length)
    })
}
