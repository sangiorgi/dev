var mysql = require('mysql');
require('dotenv').config();

const {  SERVER, USERDB , PASSWORD, DB } = process.env;

var pool  = mysql.createPool({
    connectionLimit : 10,
    host     : SERVER,
    user     : USERDB,
    password: PASSWORD,  
    database : DB,
	debug:false,
	waitForConnections: true,
	multipleStatements: true
});

module.exports = pool;