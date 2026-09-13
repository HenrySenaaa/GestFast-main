// server.js - Servidor HTTP e API RESTful do GestFast ERP
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // 1. Dashboard & Alertas
    if (pathname === '/api/dashboard' && method === 'GET') {
      const startTime = Date.now();
      const dashData = db.getDashboardData();
      const latencyMs = Date.now() - startTime;
      return sendJson(res, 200, { success: true, data: dashData, latencyMs });
    }
    if (pathname === '/api/alerts' && method === 'GET') {
      return sendJson(res, 200, { success: true, alerts: db.getAlertasCriticos() });
    }

    // 2. Categorias e Fornecedores
    if (pathname === '/api/categories' && method === 'GET') {
      return sendJson(res, 200, { success: true, categories: db.categorias });
    }
    if (pathname === '/api/suppliers' && method === 'GET') {
      return sendJson(res, 200, { success: true, suppliers: db.fornecedores });
    }

    // 3. Produtos (CRUD)
    if (pathname === '/api/products' && method === 'GET') {
      const { q, category } = parsedUrl.query;
      return sendJson(res, 200, { success: true, products: db.getProducts(q, category) });
    }
    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const id = pathname.split('/')[3];
      const prod = db.getProductById(id);
      if (!prod) return sendJson(res, 404, { success: false, error: 'Produto não encontrado' });
      return sendJson(res, 200, { success: true, product: prod });
    }
    if (pathname === '/api/products' && method === 'POST') {
      const body = await parseBody(req);
      const novo = db.saveProduct(body);
      return sendJson(res, 201, { success: true, product: novo, message: 'Produto cadastrado com sucesso!' });
    }
    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseBody(req);
      body.id_produto = id;
      const atualizado = db.saveProduct(body);
      return sendJson(res, 200, { success: true, product: atualizado, message: 'Produto atualizado com sucesso!' });
    }
    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.deleteProduct(id);
      return sendJson(res, 200, { success: true, message: 'Produto inativado do catálogo com sucesso!' });
    }

    // 4. Requisições de Fornecedores
    if (pathname === '/api/requisitions' && method === 'GET') {
      return sendJson(res, 200, { success: true, requisicoes: db.requisicoes });
    }
    if (pathname.startsWith('/api/requisitions/') && pathname.split('/').length === 4 && method === 'GET') {
      const id = pathname.split('/')[3];
      const reqFound = db.requisicoes.find(r => r.id_requisicao === Number(id));
      if (!reqFound) return sendJson(res, 404, { success: false, error: 'Requisição não encontrada' });
      return sendJson(res, 200, { success: true, requisicao: reqFound });
    }
    if (pathname === '/api/requisitions' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.produto_nome) {
        return sendJson(res, 400, { success: false, error: 'O nome do produto é obrigatório.' });
      }
      const novaReq = db.createRequisicao(body);
      return sendJson(res, 201, { success: true, requisicao: novaReq, message: 'Requisição gerada com sucesso!' });
    }
    if (pathname.match(/^\/api\/requisitions\/\d+\/status$/) && method === 'PATCH') {
      const parts = pathname.split('/');
      const id = parts[3];
      const body = await parseBody(req);
      const atualizada = db.updateRequisicaoStatus(id, body.situacao, body.justificativa);
      return sendJson(res, 200, { success: true, requisicao: atualizada, message: `Requisição atualizada para "${body.situacao}"!` });
    }

    // 5. Movimentações de Estoque (Entradas e Saídas)
    if (pathname === '/api/movements' && method === 'GET') {
      const tipo = parsedUrl.query.tipo;
      let list = db.movimentacoes;
      if (tipo) {
        list = list.filter(m => m.tipo_movimentacao.toLowerCase() === tipo.toLowerCase());
      }
      return sendJson(res, 200, { success: true, movements: list });
    }
    if (pathname === '/api/movements' && method === 'POST') {
      const body = await parseBody(req);
      const novaMov = db.registrarMovimentacaoEstoque(body);
      return sendJson(res, 201, { success: true, movement: novaMov, message: `${body.tipo_movimentacao} registrada com sucesso!` });
    }

    // 6. Vendas / Balcão (PDV)
    if (pathname === '/api/sales' && method === 'GET') {
      return sendJson(res, 200, { success: true, sales: db.vendas });
    }
    if (pathname === '/api/sales' && method === 'POST') {
      const body = await parseBody(req);
      const novaVenda = db.realizarVenda(body);
      return sendJson(res, 201, { success: true, sale: novaVenda, message: 'Venda realizada com sucesso e estoque baixado!' });
    }
    if (pathname.match(/^\/api\/sales\/\d+\/cancel$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const cancelada = db.cancelarVenda(id);
      return sendJson(res, 200, { success: true, sale: cancelada, message: 'Venda cancelada e estoque estornado!' });
    }

    // 7. Conferência de Inventário Físico
    if (pathname === '/api/inventory' && method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        conferencias: db.conferencias,
        itensParaConferencia: db.produtos.filter(p => p.status === 'Ativo')
      });
    }
    if (pathname === '/api/inventory' && method === 'POST') {
      const body = await parseBody(req);
      const conf = db.salvarConferencia(body.responsavel, body.itens, body.observacao);
      return sendJson(res, 201, { success: true, conferencia: conf, message: 'Conferência de estoque salva com sucesso!' });
    }

    // 8. Relatórios de Vendas e Desempenho
    if (pathname === '/api/reports/sales' && method === 'GET') {
      return sendJson(res, 200, { success: true, report: db.getRelatorioVendas() });
    }
  } catch (err) {
    return sendJson(res, 400, { success: false, error: err.message || 'Erro no processamento da requisição' });
  }

  // Roteamento de Arquivos Estáticos (Frontend SPA)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acesso Negado');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (readErr, indexContent) => {
        if (readErr) {
          res.writeHead(404);
          return res.end('Não encontrado');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(indexContent);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[GestFast ERP] Servidor rodando com sucesso em http://localhost:${PORT}`);
  });
}

module.exports = server;
