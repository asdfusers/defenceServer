Array.prototype.clear = function() {
  while (this.length > 0) {
    this.pop();
  }
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
};

var http = require('http');
var WebSocketServer = require('websocket').server;

var port = process.env.port || 1337;
var httpServer = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World\n');
});
httpServer.listen(port);

var wsServer = new WebSocketServer({
    httpServer: httpServer,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

const SERVER_TICK = 100;

const PID_LOGIN = 1;
const PID_ENTER_ANYONE = 2;
const PID_MOVEMENT = 3;
const PID_SYNC_SERVER_TIME = 4;
const PID_LEAVE_ANYONE = 5;
const PID_SHOOT_BULLET = 6;
const PID_HIT_ANYONE = 7;
const PID_DELETE_BULLET = 8;
const PID_REVIVE_CHARACTER = 9;

var CharacterState = function(){
return {
    'NOMAL':0,
    'DEATH':1    
    }
}();

var PF = require('pathfinding');
 var matrix = [
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
];
 
var grid = new PF.Grid(5, 5, matrix);

var finder = new PF.AStarFinder();
 
function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

function broadcast(message, skipConn)
{
    wsServer.connections.forEach(function (conn) {
                if (skipConn == conn)
                    return

                conn.send(message);
            });
}

function lineDistance( point1, point2 )
{
  var xs = 0;
  var ys = 0;

  xs = point2.x - point1.x;
  xs = xs * xs;

  ys = point2.y - point1.y;
  ys = ys * ys;

  return Math.sqrt( xs + ys );
}

function setMovementGoalAtPoint(elem, start, goal)
{    
    elem.movement.limitTime = parseInt(lineDistance(start, goal)/elem.speed);
    elem.movement.sx = start.x;
    elem.movement.sy = start.y;
    elem.movement.ex = goal.x;
    elem.movement.ey = goal.y;
    elem.movement.elapsedTime = 0;
    elem.movement.startTime = globalMgr.elapsedTime;
}

function setMovementGoalWithPathFind(elem, x, y)
{    
    const TILE_SIZE = 100;
    var start = { x: parseInt(elem.movement.cx/TILE_SIZE), y: parseInt(elem.movement.cy/TILE_SIZE) };
    var goal = { x:parseInt(x/TILE_SIZE), y:parseInt(y/TILE_SIZE)};    
    goal.x = clamp(goal.x, 0, grid.width-1);
    goal.y = clamp(goal.y, 0, grid.height-1);

    elem.pathfind.path = [];
    elem.pathfind.cpath = 0;
    setMovementGoalAtPoint(elem, {x:elem.movement.cx, y:elem.movement.cy}, {x:clamp(x, 0, (grid.width-1)*TILE_SIZE), y:clamp(y, 0, (grid.height-1)*TILE_SIZE)});

    var gridBackup = grid.clone();
    var path = finder.findPath(start.x, start.y, goal.x, goal.y, gridBackup);
    if (path.length < 2)
        return;
    path = PF.Util.smoothenPath(gridBackup, path);
    if (path.length < 2)
        return;

    for(var i = 0; i < path.length; ++i)
    {
        path[i][0] *= TILE_SIZE;
        path[i][1] *= TILE_SIZE;
    }

    elem.pathfind.path = path;
    elem.pathfind.cpath = 2;
    setMovementGoalAtPoint(elem, {x:elem.movement.cx, y:elem.movement.cy}, {x:path[1][0], y:path[1][1]});
    return;
    
}

function setMovementGoalAsDirection(elem, x, y, length)
{
    var p1 = { x: elem.movement.cx, y: elem.movement.cy };
    var p2 = { x:x, y:y};
    
    var radian = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    setMovementGoalAtPoint(elem, p1, {x:Math.cos(radian)*length+p1.x, y:Math.sin(radian)*length+p1.y});
}

function lerp(start, end, percent) {
    return start + ((end - start) * percent);
}

function inCircle (c1, c2) {
    var p1x = c1.movement.cx;
    var p1y = c1.movement.cy;
    var r1 = c1.radius;
    var p2x = c2.movement.cx;
    var p2y = c2.movement.cy;
    var r2 = c2.radius;
    var a = r1 + r2;
    var x = p1x - p2x;
    var y = p1y - p2y;
    
    if ( a > Math.sqrt( (x*x) + (y*y) ) ) {
        return true;
    }

    return false;
}

function move(elem, delta)
{           
    elem.movement.elapsedTime += delta;
    var timeLeft = elem.movement.limitTime-elem.movement.elapsedTime;
    
    if (timeLeft <= 0)    
    {
        elem.movement.cx = elem.movement.ex;
        elem.movement.cy = elem.movement.ey;
        elem.movement.elapsedTime = elem.movement.limitTime;
        return false;
    }
    
    var percentDone = 1 - timeLeft/elem.movement.limitTime;
    
    elem.movement.cx = lerp(elem.movement.sx, elem.movement.ex, percentDone) ;
    elem.movement.cy = lerp(elem.movement.sy, elem.movement.ey, percentDone) ;
    return true;
    
}



function GlobalMgr()
{
    this.updateTime = new Date().getTime();
    this.elapsedTime = 0;
    this.protocolHandler = [];
    this.inputQueue = [];
    this.userIDCounter = 0; 
    this.characters = [];
    this.connections = [];
    this.bullets = [];
    this.bulletIDCounter = 0;

    this.protocolHandler[PID_LOGIN] = onLoginReq;
    this.protocolHandler[PID_MOVEMENT] = onMovementReq;
    this.protocolHandler[PID_LEAVE_ANYONE] = onLeaveAnyoneReq;
    this.protocolHandler[PID_SHOOT_BULLET] = onShootBulletReq;
    this.protocolHandler[PID_DELETE_BULLET] = onDeleteBulletReq;
    this.protocolHandler[PID_REVIVE_CHARACTER] = onReviveCharacterReq;
}

var globalMgr = new GlobalMgr();


function updateState()
{
    var currentTime = new Date().getTime();
    var delta = currentTime-globalMgr.updateTime;
    globalMgr.elapsedTime += delta;

    var syncTimeProtocol = {id:PID_SYNC_SERVER_TIME, time:globalMgr.elapsedTime};
    broadcast(JSON.stringify(syncTimeProtocol), null); 
    
    var cloneInputQueue = globalMgr.inputQueue.slice(0);
    globalMgr.inputQueue.clear();    

    cloneInputQueue.forEach(function(e){
        var msg = e;
        var connection = e.connection;        
        
        globalMgr.protocolHandler[msg.id](connection, msg);
        
    });
    
    globalMgr.characters.forEach(function(elem){
        
        if (false == move(elem, delta))
        {
            if (elem.pathfind.cpath < elem.pathfind.path.length)
            {
                var start = {x:elem.movement.cx, y:elem.movement.cy};
                var goal = {x:elem.pathfind.path[elem.pathfind.cpath][0], y:elem.pathfind.path[elem.pathfind.cpath][1]};
                ++elem.pathfind.cpath;
                
                setMovementGoalAtPoint(elem, start, goal);
                sendUpdatePathMovement(elem);
            }
        }
    });

    globalMgr.bullets.forEach(function(elem){
        
        var movable = move(elem, delta);

        globalMgr.characters.forEach(function(character){
        
            if (elem.owner_id == character.id)
                return;

            if (true == inCircle(character, elem))
            {
                hitAnyone(character, elem);
            }
        
        });

        if (movable == false)
        {
            postDeleteBullet(elem.id);
        }
        
    });
    
    globalMgr.updateTime = currentTime;
    
}

setInterval(updateState, SERVER_TICK);

function createCharacter(connection)
{
    var id = ++globalMgr.userIDCounter;
    var myJSONObject = {
        movement:{cx:0, cy:0, sx:0, sy:0, ex:0, ey:0, limitTime:0, elapsedTime:0, startTime:globalMgr.elapsedTime},
                        hp:10,
                        speed:0.1,
                        radius:50,
                        state:CharacterState.NOMAL,
                        pathfind:{path:[], cpath:0},
                        id:id
                       };
    
    
    globalMgr.characters[id] = myJSONObject;
    globalMgr.connections[id] = connection;
    return myJSONObject;
}

function createBullet(owner)
{
    var id = ++globalMgr.bulletIDCounter;

    var myJSONObject = {
        movement:{cx:owner.movement.cx, cy:owner.movement.cy, sx:owner.movement.cx, sy:owner.movement.cy, ex:0, ey:0, limitTime:0, elapsedTime:0, startTime:globalMgr.elapsedTime},
                        dmg:1,
                        speed:0.3,
                        radius:5,
                        owner_id:owner.id,
                        id:id
                       };
    
    
    globalMgr.bullets[id] = myJSONObject;
    
    return myJSONObject;
}

function postDeleteBullet(id)
{
    postProtocolToInputQueue({id:PID_DELETE_BULLET, bullet_id:id});
}

function postProtocolToInputQueue(protocol, delay)
{
    if (delay == 0)
    {
        globalMgr.inputQueue.push(protocol);
    }
    else
    {
        setTimeout(function(){
            globalMgr.inputQueue.push(protocol);
        }, delay);
    }    
}

function hitAnyone(victim, bullet)
{
    victim.hp -= bullet.dmg;
    if (victim.hp <= 0)
    {
        if (victim.state != CharacterState.DEATH)
        {
            victim.state = CharacterState.DEATH;
            var revivePlace = {x:Math.floor((Math.random() * 300) + 1), y:Math.floor((Math.random() * 300) + 1)};
            postProtocolToInputQueue({id:PID_REVIVE_CHARACTER, characterID:victim.id, x:revivePlace.x, y:revivePlace.y, hp:10}, 5000);
        }
        victim.hp = 0;
    }

    var protocol = {id:PID_HIT_ANYONE, time:globalMgr.elapsedTime, victim:victim.id, bullet_id:bullet.id, dmg:bullet.dmg};
    broadcast(JSON.stringify(protocol), null);

    postDeleteBullet(bullet.id);
}

function onLoginReq(connection, msg)
{
    
    var newCharacter = createCharacter(connection);
    connection.userid = newCharacter.id;

    var loginProtocol = {id:PID_LOGIN, me:newCharacter, members:[], bullets:[]};

    var memberCount = 0;
    globalMgr.characters.forEach(function(e){
        if (globalMgr.userIDCounter == e.id)
            return;

        loginProtocol.members[memberCount] = e;
        memberCount++;
    });

    memberCount = 0;
    globalMgr.bullets.forEach(function(e){
        
        loginProtocol.bullets[memberCount] = e;
        memberCount++;
    });
    
    
    connection.send(JSON.stringify(loginProtocol));    

    var enterAnyoneProtocol = {id:PID_ENTER_ANYONE, anyone:newCharacter};
    broadcast(JSON.stringify(enterAnyoneProtocol), connection);
}

function onMovementReq(connection, msg)
{
    var character = globalMgr.characters[connection.userid];
    if (character.hp == 0)
        return;

    character.pathfind.path = [];
    character.pathfind.cpath = 0;
    setMovementGoalWithPathFind(character, msg.goal.x, msg.goal.y);
    
    var movementProtocol = {id:PID_MOVEMENT, time:globalMgr.elapsedTime, cx:character.movement.cx, cy:character.movement.cy, limitTime:character.movement.limitTime, characterID:connection.userid, goal:{x:character.movement.ex, y:character.movement.ey}};
    broadcast(JSON.stringify(movementProtocol), null);
}

function sendUpdatePathMovement(character)
{    
    var movementProtocol = {id:PID_MOVEMENT, time:globalMgr.elapsedTime, cx:character.movement.cx, cy:character.movement.cy, limitTime:character.movement.limitTime, characterID:character.id, goal:{x:character.movement.ex, y:character.movement.ey}};
    broadcast(JSON.stringify(movementProtocol), null);
}

function onLeaveAnyoneReq(connection, msg)
{
    broadcast(JSON.stringify(msg), null);

    delete globalMgr.characters[msg.characterID];
    delete globalMgr.connections[msg.characterID];
}

function onShootBulletReq(connection, msg)
{
    var character = globalMgr.characters[connection.userid];
    if (character.hp == 0)
        return;

    var bullet = createBullet(character);
    
    setMovementGoalAsDirection(bullet, msg.goal.x, msg.goal.y, 300);

    var shootBulletProtocol = {id:PID_SHOOT_BULLET, bullet:bullet};
    
    broadcast(JSON.stringify(shootBulletProtocol), null);
}

function onDeleteBulletReq(connection, msg)
{
    delete globalMgr.bullets[msg.bullet_id];
}

function onReviveCharacterReq(connection, msg)
{
   var character = globalMgr.characters[msg.characterID];
   if (character == null)
       return;

   character.movement.cx = msg.x;
   character.movement.cy = msg.y;
   character.movement.sx = msg.x;
   character.movement.sy = msg.y;
   character.movement.ex = msg.x;
   character.movement.ey = msg.y;
   character.movement.elapsedTime = 0;
   character.movement.limitTime = 0;
   character.movement.starTime = globalMgr.elapsedTime;
   character.hp = msg.hp;
   character.state = CharacterState.NOMAL;

   broadcast(JSON.stringify({id:PID_REVIVE_CHARACTER, character:character}), null);
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
 
    var connection = request.accept('echo-protocol', request.origin);    
    var loginProtocol = {id:PID_LOGIN};
    loginProtocol.connection = connection;
    globalMgr.inputQueue.push(loginProtocol);
    
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
    	
        
        if (message.type === 'utf8') {
            console.log('Server Received Message: ' + message.utf8Data + ' len: ' + message.utf8Data.length);

            var protocol = JSON.parse(message.utf8Data);
            protocol.connection = connection;
            globalMgr.inputQueue.push(protocol);
            
            
        }
        else if (message.type === 'binary') {
            console.log('Server Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);            
            
        }
    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        var leaveProtocol = {id:PID_LEAVE_ANYONE, characterID:connection.userid};
        globalMgr.inputQueue.push(leaveProtocol);

        
    });
    
});