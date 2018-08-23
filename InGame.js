server = require('http').Server();
var socketIO = require('socket.io');
var io = socketIO.listen(server);
var queue = require('./queue');
var redis = require('./redis');
var mysql = require('./database');



var queueObject = new queue.Queue();
var connection = mysql.connection;
var client = redis.client;
var SOCKET_LIST={};
var ROOM_LIST={};



io.sockets.on('connection', function(socket){
  console.log("connect");

  //ID CHECK
  var $ID;
  var $userName;
  socket.on('loginID', function(data){
    $ID = data;
  });

  //SessionID CHECK
  socket.on('login', function(data){
        $sessionID = $ID;
        client.get($sessionID, function(err, result){
        if(data != result)
        {
          socket.disconnect();
        }
        console.log("success");
        })
   
  });

  socket.on('disconnect', function(){
      console.log("disconnect");
    });
  
});
server.listen(5000);
