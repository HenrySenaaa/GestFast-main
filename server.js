// server.js - Servidor HTTP e API RESTful do GestFast ERP
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');
const { testarConexao } = require('./database/conexao');

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
      const dashData = await db.getDashboardData();
      const latencyMs = Date.now() - startTime;
      return sendJson(res, 200, { success: true, data: dashData, latencyMs });
    }
    if (pathname === '/api/alerts' && method === 'GET') {
      return sendJson(res, 200, { success: true, alerts: await db.getAlertasCriticos() });
    }

    // 2. Categorias e Fornecedores
    if (pathname === '/api/categories' && method === 'GET') {
      return sendJson(res, 200, { success: true, categories: await db.getCategorias() });
    }
    if (pathname === '/api/suppliers' && method === 'GET') {
      return sendJson(res, 200, { success: true, suppliers: await db.getFornecedores() });
    }

    // 3. Produtos (CRUD)
    if (pathname === '/api/products' && method === 'GET') {
      const { q, category } = parsedUrl.query;
      return sendJson(res, 200, { success: true, products: await db.getProducts(q, category) });
    }
    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const id = pathname.split('/')[3];
      const prod = await db.getProductById(id);
      if (!prod) return sendJson(res, 404, { success: false, error: 'Produto não encontrado' });
      return sendJson(res, 200, { success: true, product: prod });
    }
    if (pathname === '/api/products' && method === 'POST') {
      const body = await parseBody(req);
      const novo = await db.saveProduct(body);
      return sendJson(res, 201, { success: true, product: novo, message: 'Produto cadastrado com sucesso!' });
    }
    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseBody(req);
      body.id_produto = id;
      const atualizado = await db.saveProduct(body);
      return sendJson(res, 200, { success: true, product: atualizado, message: 'Produto atualizado com sucesso!' });
    }
    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      await db.deleteProduct(id);
      return sendJson(res, 200, { success: true, message: 'Produto inativado do catálogo com sucesso!' });
    }

    // 4. Requisições de Fornecedores
    if (pathname === '/api/requisitions' && method === 'GET') {
      return sendJson(res, 200, { success: true, requisicoes: await db.getRequisicoes() });
    }
    if (pathname.startsWith('/api/requisitions/') && pathname.split('/').length === 4 && method === 'GET') {
      const id = pathname.split('/')[3];
      const reqFound = await db.getRequisicaoById(id);
      if (!reqFound) return sendJson(res, 404, { success: false, error: 'Requisição não encontrada' });
      return sendJson(res, 200, { success: true, requisicao: reqFound });
    }
    if (pathname === '/api/requisitions' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.produto_nome) {
        return sendJson(res, 400, { success: false, error: 'O nome do produto é obrigatório.' });
      }
      const novaReq = await db.createRequisicao(body);
      return sendJson(res, 201, { success: true, requisicao: novaReq, message: 'Requisição gerada com sucesso!' });
    }
    if (pathname.match(/^\/api\/requisitions\/\d+\/status$/) && method === 'PATCH') {
      const parts = pathname.split('/');
      const id = parts[3];
      const body = await parseBody(req);
      const atualizada = await db.updateRequisicaoStatus(id, body.situacao, body.justificativa);
      return sendJson(res, 200, { success: true, requisicao: atualizada, message: `Requisição atualizada para "${body.situacao}"!` });
    }

    // 5. Movimentações de Estoque (Entradas e Saídas)
    if (pathname === '/api/movements' && method === 'GET') {
      const list = await db.getMovimentacoes(parsedUrl.query.tipo);
      return sendJson(res, 200, { success: true, movements: list });
    }
    if (pathname === '/api/movements' && method === 'POST') {
      const body = await parseBody(req);
      const novaMov = await db.registrarMovimentacaoEstoque(body);
      return sendJson(res, 201, { success: true, movement: novaMov, message: `${body.tipo_movimentacao} registrada com sucesso!` });
    }

    // 6. Vendas / Balcão (PDV)
    if (pathname === '/api/sales' && method === 'GET') {
      return sendJson(res, 200, { success: true, sales: await db.getVendas() });
    }
    if (pathname === '/api/sales' && method === 'POST') {
      const body = await parseBody(req);
      const novaVenda = await db.realizarVenda(body);
      return sendJson(res, 201, { success: true, sale: novaVenda, message: 'Venda realizada com sucesso e estoque baixado!' });
    }
    if (pathname.match(/^\/api\/sales\/\d+\/cancel$/) && method === 'POST') {
      const id = pathname.split('/')[3];
      const cancelada = await db.cancelarVenda(id);
      return sendJson(res, 200, { success: true, sale: cancelada, message: 'Venda cancelada e estoque estornado!' });
    }

    // 7. Conferência de Inventário Físico
    if (pathname === '/api/inventory' && method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        conferencias: await db.getConferencias(),
        itensParaConferencia: await db.getProducts()
      });
    }
    if (pathname === '/api/inventory' && method === 'POST') {
      const body = await parseBody(req);
      const conf = await db.salvarConferencia(body.responsavel, body.itens, body.observacao);
      return sendJson(res, 201, { success: true, conferencia: conf, message: 'Conferência de estoque salva com sucesso!' });
    }

    // 8. Relatórios de Vendas e Desempenho
    if (pathname === '/api/reports/sales' && method === 'GET') {
      return sendJson(res, 200, { success: true, report: await db.getRelatorioVendas() });
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
  testarConexao()
    .then(() => {
      console.log(`[GestFast ERP] Conectado ao MySQL (banco "${process.env.DB_NAME || 'gestfast'}").`);
      server.listen(PORT, () => {
        console.log(`[GestFast ERP] Servidor rodando com sucesso em http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error(`[GestFast ERP] Não foi possível conectar ao MySQL: ${err.message}`);
      console.error('Confira se o MySQL está ligado e se o arquivo .env está preenchido (veja .env.example).');
      process.exit(1);
    });
}

module.exports = server;
