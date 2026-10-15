// lib/logger.js - Registro de logs (RNF 06): acessos, operações e erros
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.GESTFAST_LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'gestfast.log');
const MAX_BYTES = 5 * 1024 * 1024;

function log(nivel, evento, detalhes = {}, usuario = null) {
  const linha = JSON.stringify({ ts: new Date().toISOString(), nivel, evento, usuario, ...detalhes });
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    }
    fs.appendFileSync(LOG_FILE, linha + '\n');
  } catch (e) { /* log nunca derruba o sistema */ }
  if (nivel === 'ERRO' && process.env.GESTFAST_QUIET !== '1') console.error('[ERRO]', evento, detalhes);
}

function recent(limit = 200) {
  try {
    const linhas = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    return linhas.slice(-limit).reverse().map(l => { try { return JSON.parse(l); } catch (e) { return { raw: l }; } });
  } catch (e) {
    return [];
  }
}

module.exports = { log, recent, LOG_FILE };
