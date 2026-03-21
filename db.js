const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('CONNECTING WITH:', process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASSWORD?.substring(0,4));
console.log('CONNECTING WITH:', process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASSWORD?.substring(0,4));
module.exports = pool;
