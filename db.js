const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;
const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

if (dbUrl) {
  const url = new URL(dbUrl);
  console.log('DB host:', url.hostname);
  console.log('DB user:', url.username);
  console.log('DB pass length:', url.password.length);
  console.log('DB pass first 4:', url.password.substring(0, 4));
  console.log('DB name:', url.pathname.replace('/', ''));
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
