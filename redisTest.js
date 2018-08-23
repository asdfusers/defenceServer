var redis = require("redis"),
    client = redis.createClient( 6379 , '192.168.72.128' );
    client.auth("gmlals12");
 
// client.set("login:qwerqwer" ,"some val" , function( err , result ){
//     console.log( "Resule: " );
//     console.log( result );
// });
    client.get("login:qwer", function(err, result){
        console.log("Result :");
        console.log(result);
    });
