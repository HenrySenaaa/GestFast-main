// conexao.js - Pool de conexões do GestFast com o MySQL (configurado pelo .env)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestfast',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL vem como número, não como texto
  dateStrings: true     // datas vêm como texto ('2026-09-12 10:15:00'), igual ao frontend espera
});

async function testarConexao() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

// Executa fn(conn) dentro de uma transação: grava tudo ou não grava nada.
async function transacao(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, testarConexao, transacao };
