import 'server-only';
import mysql from 'mysql2/promise';

const globalForVageDb = globalThis;

function createPool() {
  const required = ['DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => process.env[key] === undefined);

  if (missing.length > 0) {
    throw new Error(
      `Missing MySQL environment variable(s): ${missing.join(', ')}. ` +
      'Create .env.local using the supplied .env.example.'
    );
  }

  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'vage_clothing',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

/**
 * Reuse the pool across Next.js development hot reloads.
 * This module is imported only by server-side route handlers.
 */
export function getPool() {
  if (!globalForVageDb.__vageMySqlPool) {
    globalForVageDb.__vageMySqlPool = createPool();
  }

  return globalForVageDb.__vageMySqlPool;
}

/** Execute a parameterized SQL statement and return its rows/result. */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/** Run a lightweight connection check, useful for diagnostics. */
export async function checkDatabaseConnection() {
  const rows = await query('SELECT DATABASE() AS database_name, VERSION() AS mysql_version');
  return rows[0];
}
