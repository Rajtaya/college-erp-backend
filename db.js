const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;
const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (dbUrl) {
  console.log('Using DATABASE_URL connection');
  const url = new URL(dbUrl);
  pool = mysql.createPool({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace('/', ''),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} else {
  console.log('Using individual DB env vars, host:', process.env.DB_HOST);
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

module.exports = pool;
