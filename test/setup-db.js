// test/setup-db.js - Recria o banco de TESTE a partir de database/schema.sql + database/seed.sql.
// Só aceita nomes terminados em "_test", para nunca apagar o banco de verdade (gestfast).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function recriarBancoDeTeste(nome) {
  if (!/_test$/.test(nome)) throw new Error(`Banco de teste precisa terminar em "_test" (recebido: ${nome}).`);
  const ler = f => fs.readFileSync(path.join(__dirname, '..', 'database', f), 'utf8')
    .replace(/\bgestfast\b(?=\s*(;|DEFAULT|$))/gm, nome);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });
  try {
    await conn.query(ler('schema.sql'));
    await conn.query(ler('seed.sql'));
  } finally {
    await conn.end();
  }
}

module.exports = { recriarBancoDeTeste };
