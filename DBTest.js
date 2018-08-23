var mysql = require('mysql');
 
var connection = mysql.createConnection({
    host    :'192.168.72.128',
    port : 3306,
    user : 'WClient',
    password : 'gmlals12',
    database:'WTest'
});
 
connection.connect();
 var sql = 'SELECT * FROM member WHERE userID = "asdfasd"';
connection.query(sql, function(err, rows, fields) {
      if (err) throw err;
 
        else{
            console.log('rows', rows[0].userName);
            

        }
    });

