var mysql = require('mysql');

var connection = mysql.createConnection({
    host: '192.168.72.128',
    port: 3306,
    user: 'WClient',
    password: 'gmlals12',
    database: 'WTest'
});


module.exports.connection = connection;

