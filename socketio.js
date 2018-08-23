server = require('http').Server();
var socketIO = require('socket.io');
var io = socketIO.listen(server);
var queue = require('./queue');
var redis = require('./redis');
var mysql = require('./database');
var express = require('express');
var bodyParser = require('body-parser');


var queueObject = new queue.Queue();
var connection = mysql.connection;
var client = redis.client;
var SOCKET_LIST={};
var PLAYER_LIST = {};
var ROOM_LIST={};
var MONSTER_LIST = {};
var BULLET_LIST = {};
var CLOUD_LIST = {};



function ranGenerator(min, max){
  return Math.floor(Math.random()*(max-min+1)) + min;
}

var Room = function(id)
{
  var self = {
    id : id,
    roomNum : 0,
    bStart : false,
  }
  return self;
}
var Player = function(id)
{
  var self = {
    id : id,
    playerRoomNum : 0,
  }
  return self;
}
var Monster= function(id)
{
  var self = {
    id : id,
    monsterNumber : ranGenerator(0, 999999),
    startXPos : -10,
    startYPos : ranGenerator(100, 300),
    currentXPos : 0,
    currentYPos : 0,
    TargetXPos : 700,
    TargetYPos : ranGenerator(50, 400),
    normalXPos : 0,
    normalYPos : 0,
    maxSpeed : 100,
    monsterRoom : 0,
    exp : 0,
    HP : 0,
  }
  return self;
}


var Cloud= function(id)
{
  var self = {
    id : id,
    cloudNumber : ranGenerator(0, 999999),
    startXPos : -10,
    startYPos : ranGenerator(200, 250),
    currentXPos : 0,
    currentYPos : 0,
    TargetXPos : 700,
    TargetYPos : 0,
    normalXPos : 0,
    normalYPos : 0,
    maxSpeed : 100,
    cloudRoom : 0,
  }
  return self;
}


var Bullet = function(id)
{
  var self = {
    b_id : id,
    b_speed : 0,
    b_startXPos : 0,
    b_startYPos : 0,
    b_targetXPos : 0,
    b_targetYPos : 0,
    b_normalXPos : 0,
    b_normalYPos : 0,
    b_length : 0,
    b_power : 1,
    b_type : "VULCAN",
  }
  return self;
}

io.sockets.on('connection', function (socket) {
  socket.gameScore = 0;
  var player = new Player(socket.id);
  PLAYER_LIST[socket.id] = player;
  SOCKET_LIST[socket.id] = socket;
  socket.on('Lobby', function (data) {
    
    socket.join('0');
    socket.rm  = 0;
    var $board = "leaderboard";
    var sql = 'SELECT * FROM member';
    var $rowCnt;
    connection.query(sql, function (err, rows, fields) {
      if (err)
        throw err;

      var $rankScore;
      $rowCnt = rows.length;
      for (var i = 0; i < rows.length; i++) {
        $rankScore = rows[i].win * 3 + rows[i].lose * (-2) + rows[i].same;
        client.zadd($board, $rankScore, rows[i].userName, function (err, result) {
          if (err) {
            console.log("error");
            return;
          }
        })
        $rankScore = 0;
      }

    });

    //랭킹 리스트가져오기
    client.ZREVRANGE($board, 0, 20, function (err, result) {
      if (err) {
        console.log("error");
        return;
      }

      for (var i = 0; i < result.length; i++) {
        socket.emit('rank', { value: result[i] });
      }
    })

  })
  
  //ID CHECK
  var $ID;
  var $userName;
  socket.on('loginID', function(data){
    console.log("loginID : " + data);
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
        var sql = 'SELECT * FROM member WHERE userID = "' + $ID + '"';
        connection.query(sql, function(err, rows, fields) {
              if (err) throw err;
              $userName = rows[0].userName;
              socket.emit('userInfo', { value: rows[0].userName + " " + rows[0].win + " " + rows[0].lose + " " + rows[0].same + " " + rows[0].score});
              socket.IDs = $ID;
              socket.userName = rows[0].userName;
              socket.win = rows[0].win;
              socket.lose = rows[0].lose;
              socket.same = rows[0].same;
              socket.score = rows[0].score;
              socket.Missile = rows[0].Missile;
              socket.Cannon = rows[0].Cannon;
            });        
        })
   
  });

  var update = function(ID) {
    var sql = 'SELECT * FROM member WHERE userID = "' + ID + '"';
    connection.query(sql, function(err, rows, fields) {
          if (err) throw err;
          socket.userName = rows[0].userName;
          socket.win = rows[0].win;
          socket.lose = rows[0].lose;
          socket.same = rows[0].same;
          socket.score = rows[0].score;
          socket.Missile = rows[0].Missile;
          socket.Cannon = rows[0].Cannon;
          socket.emit('getScore', { value : socket.score })

        });        
  }
  //Chatting
  socket.on('chat', function(data){
    io.sockets.to('0').emit('chat', { value: $userName + " : "+ data});
    console.log(io.sockets.manager.rooms[0]);
  });
 
  //Random Matching
  socket.on('gameStart', function(data){
    var check = false;
    for(var i=0; i<queueObject.dataStore.length; i++)
    {
      if(queueObject.dataStore[i]  == socket)
        check = true;
    }
    if(!check)
    queueObject.enqueue(socket);
    
  });
  socket.on('gun', function(data) {
    var strArray = data.split(' ');
    var weaponType = strArray[0];
    var dmg;
    if(weaponType == 0)
    {
        dmg = 1;
    }
    else if(weaponType == 1)
    {
      dmg = 8;
    }
    else {
      dmg = 20;
    }
    var monsterNum = strArray[1];
    for(var i in MONSTER_LIST)
    {
      var monster = MONSTER_LIST[i];
      if(monster.monsterNumber == monsterNum)
      {
        monster.HP = monster.HP - dmg;
        if(monster.HP <= 0)
        {
          io.sockets.in(socket.rm).emit('killUnit', { number: parseInt(monsterNum)});
          socket.gameScore += monster.exp;
           delete MONSTER_LIST[i];
        }
      }
    }
  })

socket.on('starts', function(data){
  var sql = 'SELECT * FROM member WHERE userID = "' + $ID + '"';
  connection.query(sql, function(err, rows, fields) {
    if (err) 
      throw err;
      socket.Missile = rows[0].Missile;
      socket.Cannon = rows[0].Cannon;
    })

  socket.emit('playerInfo', {missileCnt: socket.Missile, cannonCnt: socket.Cannon});
})

socket.on('gameOver', function(data){
  var strArray = data.split(' ');
  sql = 'call updateBullet(?,?,?)';
  var params = [strArray[0], strArray[1], socket.userName];
  connection.query(sql, params,function (err, rows, fields) {
    if (err) throw err;
    else {
      console.log("success");
      update(socket.IDs);

    }
  });
  

})
socket.on('updateState', function(data){

  socket.emit('info', { userName: socket.userName, userWin: socket.win, userlose: socket.lose, usersame: socket.same,userScore: socket.score
  , userMissile: socket.Missile, userCannon:socket.Cannon});

})

  socket.on('bulletInfo', function(data) {
    var strArray = data.split(' ');
    var bullet = Bullet(ranGenerator(0, 9999));
    bullet.b_speed = parseInt(strArray[0]);
    bullet.b_startXPos = parseInt(strArray[1]);
    bullet.b_startYPos =  parseInt(strArray[2]);
    bullet.b_targetXPos =  parseInt(strArray[3]);
    bullet.b_targetYPos = parseInt(strArray[4]);
    bullet.b_normalXPos =  parseInt(strArray[5]);
    bullet.b_normalYPos =  parseInt(strArray[6]);
    bullet.b_type = strArray[7];



    console.log(bullet.b_ty)

    socket.broadcast.to(socket.rm).emit('EnemyShoot', {
  
      speed: bullet.b_speed,
      startXPos: bullet.b_startXPos,
      startYPos: bullet.b_startYPos,
      targetXPos: bullet.b_targetXPos,
      targetYPos: bullet.b_targetYPos,
      normalXPos: bullet.b_normalXPos,
      normalYPos: bullet.b_normalYPos,
      weaponType: bullet.b_type,

    } )
  })
   
  socket.on('buyCannon', function(data){
    if (socket.score >= 4000) {

      var sql = 'SELECT score, Cannon FROM member WHERE userName = "' + socket.userName + '"';
      connection.query(sql, function (err, rows, fields) {
        if (err)   throw err;  
        else {
        socket.score = rows[0].score;
        socket.Cannon = rows[0].Cannon;

        }
      });

       sql = 'call cannonBuy(?,?,?)';
      var params = [10, 4000, socket.userName];
      connection.query(sql, params,function (err, rows, fields) {
        if (err) throw err;
        else {
          console.log("success");
          update(socket.IDs);

        }
      });
    }
    else{
      socket.emit('failBuy', {value : "fail"})
    }
  });
  
  socket.on('getScore', function(data){
      socket.emit('getScores', { value : socket.score })
  })
  socket.on('buyMissile', function(data){
    if (socket.score >= 8000) {

      var sql = 'SELECT score, Missile FROM member WHERE userName = "' + socket.userName + '"';
      connection.query(sql, function (err, rows, fields) {
        if (err) throw err;
        socket.score = rows[0].score;
        socket.Missile = rows[0].Missile;
        });
    
       sql = 'call missileBuy(?,?,?)'
      var params = [10, 8000, socket.userName];
      connection.query(sql, params,function (err, rows, fields) {
        if (err) throw err;
        else{
          console.log("success");
          update(socket.IDs);
        }
      });
    }
  });

  socket.on('gameEnd', function(data){
    sql = 'call updateGameScore(?,?)'
    var params = [socket.gameScore, socket.userName];
    connection.query(sql, params,function (err, rows, fields) {
      if (err) throw err;
      else{
        console.log("success");
        update(socket.IDs);
      }
    })

    socket.score += socket.gameScore;
    socket.broadcast.to(socket.rm).emit('enemyResult', {enemyName: socket.userName, enemyScore: socket.gameScore}); // 나를 제외한 그룹 전체
    socket.emit('userResult', { userScore: socket.gameScore})
    
   
    
    setTimeout(function() {
        socket.emit('showResult', { value : "END"})
      for (var i in MONSTER_LIST) {
        var monster = MONSTER_LIST[i];
        if (monster.monsterRoom == socket.rm)
          delete MONSTER_LIST[i];
          socket.leave(socket.rm)
          socket.join('0');
        

      }
    }, 5000)

    
    socket.gameScore = 0;

  
  })

  socket.on('result', function (data) {
    var strArray = data.split(' ');
    var myScore = parseInt(strArray[0]);
    var enemyScore = parseInt(strArray[1]);
    if (myScore > enemyScore)
      socket.win++;
    else if (myScore < enemyScore)
      socket.lose++;
    else
      socket.same++;

      sql = 'call updateResult(?,?,?,?)'
    var params = [socket.win, socket.lose, socket.same,socket.userName];
    connection.query(sql, params,function (err, rows, fields) {
      if (err) throw err;
      else{
        console.log("success");
        update(socket.IDs);
      }
    })

  })
  socket.on('disconnect', function(){
      console.log("disconnect");
      socket.leave(socket.rm);
      delete SOCKET_LIST[socket.id];
    });
  

});


setInterval(function () {
 
  var rooms = io.sockets.manager.rooms;
  for (var key in rooms){
    var roomKey = key.replace('/', '');
    if(roomKey != 0 )
    {
      if(ROOM_LIST[roomKey].bStart == true)
      {
      var monster = Monster(ranGenerator(1, 5));
      switch(monster.id)
      {
        case 1:
        {
        monster.HP = 35;
        monster.exp =  monster.HP;
        }
        break;
        case 2:
        {
        monster.HP = 35;
        monster.exp =  monster.HP;
        }
        break;
        case 3:
        {
        monster.HP = 35;
        monster.exp =  monster.HP;
        }
        break;
        case 4:
        {
        monster.HP = 35;
        monster.exp =  monster.HP;
        }
        break;
        case 5:
        {
        monster.HP =35;
        monster.exp =  monster.HP;
        }
        break;
      }
      monster.monsterRoom = roomKey;
      monster.currentXPos = monster.startXPos;
      monster.currentYPos = monster.startYPos;
      
      var length = Math.sqrt(Math.pow(monster.TargetXPos - monster.startXPos, 2) + Math.pow(monster.TargetYPos - monster.startYPos, 2));
      monster.normalXPos = (monster.TargetXPos - monster.startXPos) / length;
      monster.normalYPos = (monster.TargetYPos - monster.startYPos) / length;



      MONSTER_LIST[monster.monsterNumber] = monster;
      io.sockets.in(monster.monsterRoom).emit('CreateShip', { ShipNumber: monster.id, startXPos: monster.startXPos, startYPos: monster.startYPos,targetXPos: monster.TargetXPos,targetYPos: monster.TargetYPos
        ,monsterNumber: monster.monsterNumber, speed: monster.maxSpeed });
      }
    }
   
  }
}
  , ranGenerator(500, 1500));

  setInterval(function () {
 
    var rooms = io.sockets.manager.rooms;
    for (var key in rooms){
      var roomKey = key.replace('/', '');
      if(roomKey != 0 )
      {
        if(ROOM_LIST[roomKey].bStart == true)
        {
        var cloud = Cloud(ranGenerator(1, 2));
       
        cloud.cloudRoom = roomKey;
        cloud.currentXPos = cloud.startXPos;
        cloud.currentYPos = cloud.startYPos;
        

        CLOUD_LIST[cloud.cloudNumber] = cloud;
        io.sockets.in(cloud.cloudRoom).emit('CreateCloud', { cloudNumber: cloud.id, startXPos: cloud.startXPos, startYPos: cloud.startYPos,targetXPos: cloud.TargetXPos,
          targetYPos: cloud.TargetYPos});

        delete CLOUD_LIST[cloud.cloudNumber];
        }
      }
     
    }
  }
    , ranGenerator(6000, 7000));

    




  setInterval(function() {
    if(queueObject.dataStore.length % 2 == 0 && queueObject.dataStore.length != 0)
  {
    var userRoom = Room(ranGenerator(0, 99999));
    var firstSocket = queueObject.dataStore[0];
    firstSocket.leave('0');
    firstSocket.join(userRoom.id);
    PLAYER_LIST[firstSocket.id].playerRoomNum = userRoom.id;
    firstSocket.position = 1;
    SOCKET_LIST[firstSocket.id] = firstSocket;
    SOCKET_LIST[firstSocket.id].rm = userRoom.id;
    queueObject.dataStore.shift();      


    var secondSocket = queueObject.dataStore[0];
    secondSocket.leave('0');
    secondSocket.join(userRoom.id); 
    secondSocket.position = 2;
    PLAYER_LIST[secondSocket.id].playerRoomNum = userRoom.id;
    SOCKET_LIST[secondSocket.id].rm = userRoom.id;
    SOCKET_LIST[secondSocket.id] = secondSocket;
    queueObject.dataStore.shift();
    
    
    userRoom.bStart = true;
    ROOM_LIST[userRoom.id] = userRoom;
    console.log(ROOM_LIST[userRoom.id].bStart);

    io.sockets.in(userRoom.id).emit('GameStart', {value : "GameStart"});
    firstSocket.broadcast.to(userRoom.id).emit('positions', {position : 2 });
    secondSocket.broadcast.to(userRoom.id).emit('positions', {position : 1 });
    
    setTimeout(function() {
      ROOM_LIST[userRoom.id].bStart = '0';
      io.sockets.in(userRoom.id).emit('GameEnd', { value : "END"})
    }, 10000)
  }
  }, 2000);


  
  setInterval(function() {
    for(var i in MONSTER_LIST)
    {
        var monster = MONSTER_LIST[i];
        monster.currentXPos = monster.currentXPos + (monster.maxSpeed * monster.normalXPos * 0.016666);
        monster.currentYPos = monster.currentYPos + (monster.maxSpeed * monster.normalYPos * 0.016666);

        if(monster.currentXPos >= 650 || monster.currentYPos >= 650)
        {
         
          delete MONSTER_LIST[i];
    
        }
    }


  }, 1000/60)

server.listen(4000);
