import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }
  return pool;
}
