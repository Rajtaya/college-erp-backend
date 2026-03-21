const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.MYSQL_URL;

const pool = connectionString
  ? mysql.createPool(connectionString)
  : mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

module.exports = pool;
