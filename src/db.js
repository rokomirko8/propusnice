const crypto = require('crypto');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

function sslConfig() {
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  if (process.env.DB_SSL === 'false') return false;
  return /render\.com/.test(connectionString || '') ? { rejectUnauthorized: false } : false;
}

const pool = new Pool({ connectionString, ssl: sslConfig() });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passes (
      id         UUID PRIMARY KEY,
      name       TEXT NOT NULL,
      document   TEXT NOT NULL,
      issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      status     TEXT NOT NULL DEFAULT 'ACTIVE'
                 CHECK (status IN ('ACTIVE', 'CANCELLED'))
    )
  `);
}

async function counts() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
    FROM passes
  `);
  return rows[0];
}

async function list() {
  const { rows } = await pool.query('SELECT * FROM passes ORDER BY issued_at DESC');
  return rows;
}

async function get(id) {
  const { rows } = await pool.query('SELECT * FROM passes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(name, document) {
  const { rows } = await pool.query(
    'INSERT INTO passes (id, name, document) VALUES ($1, $2, $3) RETURNING *',
    [crypto.randomUUID(), name, document]
  );
  return rows[0];
}

async function cancel(id) {
  const { rowCount } = await pool.query(
    "UPDATE passes SET status = 'CANCELLED' WHERE id = $1",
    [id]
  );
  return rowCount > 0;
}

async function remove(id) {
  const { rowCount } = await pool.query('DELETE FROM passes WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { pool, init, counts, list, get, create, cancel, remove };
