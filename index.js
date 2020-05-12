// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var request = require('request');
var voteCounter = [];
const vote = {};

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
var usersInRoom = 0;
var roomCapacity = 2;


io.on('connection', (socket) => {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    roomCode = socket.roomCode;
    socket.to(roomCode).emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  socket.on('join room', (roomCode) => {
    socket.roomCode = roomCode
    socket.join(roomCode);

    console.log(socket.username + " joined the room " + roomCode);

    //confirm joining of room
    io.to(roomCode).emit("room joined", {
      message: "you joined a new room ",
      room: roomCode
    });
  });

  socket.on('start game', () => {
    //make api request with location
    let location = socket.location;
    let locationURL = "https://api.yelp.com/v3/businesses/search?location="+location+"&radius=15000"

    let options = { 
      url: locationURL,
      method: 'GET',
      headers: {'Authorization' : 'Bearer 0epLASZWAWOFI3sj91YPkUoTxwK_v5hM1jecpIjgLU4LR0JX23Qj9ABH-WfRa_sjwJIuSPm0KUNQk0dPWVJHrnw51oEZwRW1JZZcRUnj4czjU8XKSeLgnEyWz7l3XnYx'}
    };

    request(options, (err, res, body) => {
      if (err) {
          return console.log(err);
      }
      console.log(JSON.parse(body));
       //parse body response to send to client
      content = JSON.parse(body);

      //businesses is an array of json objects containing data about each business
      let businesses = content.businesses;
      let business = businesses.shift();
      console.log(business.name);
      socket.businesses = businesses;

      //set votes to zero
      voteCounter[roomCode] = Object.create(vote);
      voteCounter[roomCode].yes = 0;
      voteCounter[roomCode].no = 0;
      voteCounter[roomCode].list = businesses;

      io.to(socket.roomCode).emit("game starting", {
        businessName: business.name
      });
    });

  });

 //TODO: handle yes/no voting events on the back-end. see if there are votes that still need to be placed
         // and serve the next restaurant if necessary
  socket.on('yes', () => {
    let roomCode = socket.roomCode;
    voteCounter[roomCode].yes += 1

    io.to(socket.roomCode).emit("vote counted", {
      username: socket.username,
      message: 'I have voted.'
    });

    if(voteCounter[roomCode].yes >= 2) {
      console.log("we have a winner!");
      io.to(socket.roomCode.emit("winner"));
    }
    
  });

  socket.on('no', () => {
    let roomCode = socket.roomCode;
    let businesses = voteCounter[roomCode].list;

    voteCounter[roomCode].no += 1

    io.to(socket.roomCode).emit("vote counted", {
      username: socket.username,
      message: 'I have voted'
    });

    if(voteCounter[roomCode].no >= 1) {
      console.log("game goes on");
      //serve next business and reset vote count
      voteCounter[roomCode].yes = 0;
      voteCounter[roomCode].no = 0;

      let business = businesses.shift();
      console.log(business.name);
      voteCounter[roomCode].list = businesses;

      io.to(socket.roomCode).emit("game continuing", {
        businessName: business.name
      });

    }
  })

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

  socket.on('send location', (location) => {
    socket.location = location

    console.log('server has recieved location: ' + location);
  });
});
