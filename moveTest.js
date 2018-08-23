server = require('http').Server();
var socketIO = require('socket.io');
var io = socketIO.listen(server);

var SOCKET_LIST={};
var socketRoom = {};

io.sockets.on('connection', function(socket){
  console.log("connect");
  socket.id = Math.random();
  socket.x = 200;
  socket.y = 200;

  SOCKET_LIST[socket.id] = socket;

var rooms = io.sockets.manager.rooms;
        for (var key in rooms){
            if (key == ''){
                continue;
            }
            // 혼자있으면 입장
            if (rooms[key].length == 1){
                var roomKey = key.replace('/', '');
                socket.join(roomKey);
             //   io.sockets.in(roomKey).emit('hello', {x:socket.x, y:socket.y});
                socketRoom[socket.id] = roomKey;
                return;
            }
        }
        // 빈방이 없으면 혼자 방만들고 기다림.
        socket.join(socket.id);
        socketRoom[socket.id] = socket.id;
       // io.sockets.in(roomKey).emit('hello', {x:14});

        socket.on('disconnect', function(data){
            var key = socketRoom[socket.id];
            delete SOCKET_LIST[socket.id];
            socket.leave(key);
            io.sockets.in(key).emit('disconnect');
            var clients = io.sockets.clients(key);
            for (var i = 0; i < clients.length; i++){
                clients[i].leave(key);
            }
        });

        setInterval(function(){
            var pack = [];
            for(var i in SOCKET_LIST){
                var socket = SOCKET_LIST[i];
                socket.x++;
                socket.y++;
                pack.push({
                    x:socket.x,
                    y:socket.y,
                });    
            }
                        
            var rooms = io.sockets.manager.rooms;
            for (var key in rooms){
                    var roomKey = key.replace('/', '');
                    for(var i in SOCKET_LIST){
                        var socket = SOCKET_LIST[i];
                          io.sockets.in(roomKey).emit('hello', {x: socket.x, y: socket.y});
                    }
                }
            }
        ,1000/25);
          
            
});



   
   

server.listen(4000);
