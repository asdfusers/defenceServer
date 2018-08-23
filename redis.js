var redis = require("redis");
var client;
client = redis.createClient( 6379 , '192.168.72.128' );
client.auth("gmlals12");

module.exports.client = client;