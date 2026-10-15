// lib/gateways.js - Integrações externas simuladas (operadora de cartão e API do fornecedor)
const { HttpError } = require('./errors');

function autorizarPagamento(forma, valor, cfg) {
  if (String(forma).startsWith('Cartão') && cfg.simularCartaoNegado) {
    throw new HttpError(402, 'Transação Negada pela Operadora');
  }
  return { autorizado: true, nsu: String(Date.now()).slice(-8) };
}

function comunicarFornecedor(acao, requisicao, cfg) {
  if (cfg.simularFornecedorIndisponivel) {
    throw new HttpError(503, 'Falha de comunicação com o sistema do fornecedor, tente novamente mais tarde.');
  }
  return { protocolo: `${acao}-${Date.now()}` };
}

module.exports = { autorizarPagamento, comunicarFornecedor };
