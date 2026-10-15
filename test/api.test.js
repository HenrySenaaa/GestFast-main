// Testes de API baseados nos cenários BDD do Apêndice F do relatório.  Execução: npm test
const os = require('os');
const path = require('path');
const fs = require('fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gestfast-'));
process.env.GESTFAST_DATA = path.join(tmp, 'db.json');
process.env.GESTFAST_LOG_DIR = path.join(tmp, 'logs');
process.env.GESTFAST_QUIET = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const server = require('../server');
const db = require('../db');

let base;
test.before(async () => { await new Promise(r => server.listen(0, r)); base = `http://localhost:${server.address().port}`; });
test.after(() => server.close());

function cliente() {
  let cookie = '';
  const call = async (method, url, body, raw) => {
    const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    if (raw) return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
    return { status: res.status, ...(await res.json()) };
  };
  return { call, get: (u) => call('GET', u), post: (u, b) => call('POST', u, b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u, b) => call('DELETE', u, b || {}), raw: (u) => call('GET', u, null, true) };
}
async function logar(email, senha) { const c = cliente(); const r = await c.post('/api/auth/login', { email, senha }); assert.equal(r.status, 200, r.error); return c; }
const admin = () => logar('proprietario@padarianovayork.com', 'admin123');
const func = () => logar('henry@padarianovayork.com', 'func123');
const back = () => logar('backoffice@padarianovayork.com', 'backoffice123');

test('Cenário 5/6: login válido e credenciais inválidas', async () => {
  const c = cliente();
  let r = await c.post('/api/auth/login', { email: 'nao@existe.com', senha: 'x' });
  assert.equal(r.status, 401); assert.equal(r.error, 'E-mail ou senha incorretos');
  r = await c.post('/api/auth/login', { email: 'proprietario@padarianovayork.com', senha: 'admin123' });
  assert.equal(r.status, 200); assert.equal(r.message, 'Login realizado com sucesso');
  assert.equal((await c.get('/api/auth/me')).user.perfil, 'Administrador');
  await c.post('/api/auth/logout');
  assert.equal((await c.get('/api/auth/me')).status, 401);
});

test('API exige autenticação e respeita perfis', async () => {
  assert.equal((await cliente().get('/api/products')).status, 401);
  const f = await func();
  assert.equal((await f.get('/api/users')).status, 403);
  assert.equal((await f.get('/api/reports/sales')).status, 403);
  assert.equal((await f.post('/api/products', { nome_produto: 'X' })).status, 403);
  const b = await back();
  assert.equal((await b.post('/api/sales', { itens: [] })).status, 403);
});

test('Senhas são armazenadas com hash (RNF 05)', () => {
  assert.ok(db.usuarios.every(u => u.senha.startsWith('scrypt$')));
});

test('Cenários 10-18: manter funcionários', async () => {
  const a = await admin();
  let r = await a.post('/api/users', { nome: 'Maria Silva', email: 'maria@padaria.com', senha: 'senha123', id_perfil: 3 });
  assert.equal(r.status, 201);
  const id = r.user.id_usuario;
  assert.equal((await a.post('/api/users', { nome: 'Outra', email: 'MARIA@padaria.com', senha: 'senha123', id_perfil: 3 })).error, 'O login informado já está em uso. Informe outro identificador.');
  assert.equal((await a.post('/api/users', { nome: '', email: 'x', senha: '1', id_perfil: 9 })).status, 400);
  assert.equal((await a.put(`/api/users/${id}`, { cargo: 'Padeira' })).user.cargo, 'Padeira');
  assert.equal((await a.put(`/api/users/${id}`, { id_perfil: 2 })).user.perfil, 'BackOffice');
  assert.equal((await a.get('/api/users?id_perfil=2')).users.some(u => u.id_usuario === id), true);
  assert.equal((await a.get('/api/users?q=maria')).users.length, 1);
  const m = await logar('maria@padaria.com', 'senha123');
  assert.equal((await a.patch(`/api/users/${id}/status`, { status: 'Inativo' })).status, 200);
  assert.equal((await m.get('/api/products')).status, 401);
  const c = cliente();
  const bloq = await c.post('/api/auth/login', { email: 'maria@padaria.com', senha: 'senha123' });
  assert.equal(bloq.error, 'Sua conta está inativa. Entre em contato com o administrador');
  assert.equal((await a.patch('/api/users/1/status', { status: 'Inativo' })).status, 400); // não desativa a si/único admin
});

test('Cenários 19-27: manter produtos (validações, filtro, inativar)', async () => {
  const a = await admin();
  const ok = { nome_produto: 'Broa de Milho', descricao: 'Broa de milho caseira assada na hora', id_categoria: 1, unidade: 'UN', preco_custo: 1, preco_venda: 4, preco_min: 3, preco_max: 6, estoque_minimo: 5, quantidade_estoque: 20 };
  let r = await a.post('/api/products', ok);
  assert.equal(r.status, 201);
  const id = r.product.id_produto;
  assert.equal((await a.post('/api/products', { ...ok, preco_venda: 0 })).error, 'O preço de venda deve ser maior que zero.');
  assert.equal((await a.post('/api/products', { ...ok, nome_produto: '' })).status, 400);
  assert.equal((await a.post('/api/products', { ...ok, codigo_barras: '78910001' })).status, 400);
  assert.equal((await a.post('/api/products', { ...ok, estoque_minimo: 2.5 })).status, 400);
  assert.equal((await a.get('/api/products?category=1')).products.every(p => p.id_categoria === 1), true);
  assert.equal((await a.put(`/api/products/${id}`, { ...ok, preco_venda: 5 })).product.preco_venda, 5);
  assert.equal((await a.put(`/api/products/${id}`, { ...ok, estoque_minimo: 0 })).product.estoque_minimo, 0);
  assert.equal((await a.del(`/api/products/${id}`)).status, 200);
  assert.equal((await a.get('/api/products')).products.some(p => p.id_produto === id), false);
  assert.equal((await a.get('/api/products?status=Inativo')).products.some(p => p.id_produto === id), true);
  assert.equal((await a.patch(`/api/products/${id}/status`, { status: 'Ativo' })).status, 200);
  const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const pi = await a.put(`/api/products/${id}`, { ...ok, imagem_data: img });
  assert.match(pi.product.imagem, /^uploads\/prod-/);
  const f = await fetch(`${base}/${pi.product.imagem}`);
  assert.equal(f.status, 200);
  assert.equal((await a.put(`/api/products/${id}`, { ...ok, imagem_data: 'data:text/html;base64,AAAA' })).status, 400);
});

test('Cenário 7: venda com baixa automática, quantidade inteira e preço dentro da faixa', async () => {
  const f = await func();
  const antes = db.getProductById(8).quantidade_estoque;
  let r = await f.post('/api/sales', { itens: [{ id_produto: 8, quantidade: 3 }], forma_pagamento: 'PIX' });
  assert.equal(r.status, 201); assert.equal(r.message, 'Venda realizada com sucesso');
  assert.equal(db.getProductById(8).quantidade_estoque, antes - 3);
  assert.equal(r.sale.valor_total, 18);
  // bug "quant" quebrado: 1,3 em UN deve ser recusado; em KG é aceito
  assert.match((await f.post('/api/sales', { itens: [{ id_produto: 1, quantidade: 1.3 }] })).error, /só aceita quantidades inteiras/);
  assert.equal((await f.post('/api/sales', { itens: [{ id_produto: 4, quantidade: 1.3 }] })).status, 201);
  assert.equal((await f.post('/api/sales', { itens: [{ id_produto: 8, quantidade: 1, valor_unitario: 1 }] })).status, 400);
  assert.equal((await f.post('/api/sales', { itens: [] })).status, 400);
});

test('Exceções de venda: estoque insuficiente, produto inexistente, cartão negado, desconto acima do limite', async () => {
  const f = await func();
  assert.match((await f.post('/api/sales', { itens: [{ id_produto: 3, quantidade: 500 }] })).error, /Quantidade indisponível em estoque/);
  assert.equal((await f.post('/api/sales', { itens: [{ id_produto: 9999, quantidade: 1 }] })).error, 'Produto não cadastrado.');
  assert.match((await f.post('/api/sales', { itens: [{ id_produto: 8, quantidade: 10 }], desconto: 50, desconto_tipo: 'percentual' })).error, /limite permitido/);
  const a = await admin();
  await a.put('/api/settings', { simularCartaoNegado: true });
  const estoque = db.getProductById(8).quantidade_estoque;
  const neg = await f.post('/api/sales', { itens: [{ id_produto: 8, quantidade: 1 }], forma_pagamento: 'Cartão Crédito' });
  assert.equal(neg.error, 'Transação Negada pela Operadora');
  assert.equal(db.getProductById(8).quantidade_estoque, estoque); // nada gravado
  await a.put('/api/settings', { simularCartaoNegado: false });
});

test('Cancelar/editar/excluir venda (cenários 8 e 9, RF 09)', async () => {
  const f = await func();
  const v = (await f.post('/api/sales', { itens: [{ id_produto: 8, quantidade: 2 }] })).sale;
  const est = db.getProductById(8).quantidade_estoque;
  // edição recalcula total e ajusta estoque
  let r = await f.put(`/api/sales/${v.id_venda}`, { itens: [{ id_produto: 8, quantidade: 5 }] });
  assert.equal(r.sale.valor_total, 30); assert.equal(db.getProductById(8).quantidade_estoque, est - 3);
  // cancelamento exige senha de gerente
  assert.equal((await f.post(`/api/sales/${v.id_venda}/cancel`, { motivo: 'Cliente desistiu da compra', autorizador_email: 'henry@padarianovayork.com', autorizador_senha: 'func123' })).status, 403);
  r = await f.post(`/api/sales/${v.id_venda}/cancel`, { motivo: 'Cliente desistiu da compra', autorizador_email: 'proprietario@padarianovayork.com', autorizador_senha: 'admin123' });
  assert.equal(r.sale.status_venda, 'Cancelada'); assert.equal(db.getProductById(8).quantidade_estoque, est + 2);
  assert.equal((await f.post(`/api/sales/${v.id_venda}/cancel`, { motivo: 'Cliente desistiu da compra', autorizador_email: 'proprietario@padarianovayork.com', autorizador_senha: 'admin123' })).status, 400);
  // exclusão: só administrador
  assert.equal((await f.del(`/api/sales/${v.id_venda}`, {})).status, 403);
  const a = await admin();
  assert.equal((await a.del(`/api/sales/${v.id_venda}`, { autorizador_email: 'proprietario@padarianovayork.com', autorizador_senha: 'admin123' })).message, 'Venda excluída com sucesso');
  assert.equal((await a.get(`/api/sales/${v.id_venda}`)).status, 404);
});

test('Cenários 1-2: requisição ao fornecedor, recebimento parcial/total e cancelamento com justificativa', async () => {
  const f = await func();
  const base = { id_produto: 6, quantidade_pedida: 10, fornecedor: 'Moinho Paulista de Trigo', valor_unitario: 4.1 };
  let r = await f.post('/api/requisitions', base);
  assert.equal(r.status, 201); assert.equal(r.message, 'Pedido realizado com sucesso');
  const id = r.requisicao.id_requisicao;
  assert.equal((await f.post('/api/requisitions', { ...base, fornecedor: 'Inventado' })).status, 400);
  const est = db.getProductById(6).quantidade_estoque;
  r = await f.patch(`/api/requisitions/${id}/status`, { situacao: 'Finalizado', quantidade_recebida: 4 });
  assert.equal(r.requisicao.situacao, 'Em Aberto'); assert.equal(db.getProductById(6).quantidade_estoque, est + 4);
  assert.equal((await f.patch(`/api/requisitions/${id}/status`, { situacao: 'Finalizado', quantidade_recebida: 99 })).status, 400);
  r = await f.patch(`/api/requisitions/${id}/status`, { situacao: 'Finalizado' });
  assert.equal(r.requisicao.situacao, 'Finalizado'); assert.equal(db.getProductById(6).quantidade_estoque, est + 10);
  // funcionário não avança status (financeiro/backoffice)
  const r2 = (await f.post('/api/requisitions', base)).requisicao.id_requisicao;
  assert.equal((await f.patch(`/api/requisitions/${r2}/status`, { situacao: 'Cotado' })).status, 403);
  const b = await back();
  assert.equal((await b.patch(`/api/requisitions/${r2}/status`, { situacao: 'Cotado' })).requisicao.situacao, 'Cotado');
  assert.equal((await b.patch(`/api/requisitions/${r2}/status`, { situacao: 'AF Gerada' })).requisicao.situacao, 'AF Gerada');
  // cancelamento
  assert.equal((await f.patch(`/api/requisitions/${r2}/status`, { situacao: 'Cancelado', justificativa: 'curto' })).status, 400);
  const a = await admin();
  await a.put('/api/settings', { simularFornecedorIndisponivel: true });
  assert.match((await f.patch(`/api/requisitions/${r2}/status`, { situacao: 'Cancelado', justificativa: 'Pedido duplicado no sistema' })).error, /Falha de comunicação com o sistema do fornecedor/);
  await a.put('/api/settings', { simularFornecedorIndisponivel: false });
  r = await f.patch(`/api/requisitions/${r2}/status`, { situacao: 'Cancelado', justificativa: 'Pedido duplicado no sistema' });
  assert.equal(r.message, 'Solicitação de cancelamento encaminhada com sucesso');
  assert.equal((await f.patch(`/api/requisitions/${r2}/status`, { situacao: 'Finalizado' })).status, 400);
});

test('RF 04: movimentação individual e em lote, com atomicidade', async () => {
  const f = await func();
  const e1 = db.getProductById(5).quantidade_estoque, e2 = db.getProductById(6).quantidade_estoque;
  let r = await f.post('/api/movements', { tipo_movimentacao: 'Entrada', observacao: 'Recebimento de caixa de insumos', itens: [{ id_produto: 5, quantidade: 10 }, { id_produto: 6, quantidade: 5 }] });
  assert.equal(r.status, 201); assert.equal(r.movements.length, 2);
  assert.equal(db.getProductById(5).quantidade_estoque, e1 + 10);
  r = await f.post('/api/movements', { tipo_movimentacao: 'Saída', observacao: 'Descarte por validade vencida', itens: [{ id_produto: 5, quantidade: 1 }, { id_produto: 6, quantidade: 9999 }] });
  assert.equal(r.status, 400);
  assert.equal(db.getProductById(5).quantidade_estoque, e1 + 10); // rollback do lote
  assert.equal((await f.post('/api/movements', { tipo_movimentacao: 'Saída', observacao: 'curto', id_produto: 5, quantidade: 1 })).status, 400);
  assert.equal((await f.get('/api/movements?tipo=Entrada')).movements.every(m => m.tipo_movimentacao === 'Entrada'), true);
});

test('RF 06: conferência de estoque ajusta saldos e registra divergência', async () => {
  const f = await func();
  const antes = db.getProductById(12).quantidade_estoque;
  const r = await f.post('/api/inventory', { observacao: 'Conferência quinzenal do estoque', itens: [{ id_produto: 12, quantidade_fisica: antes - 7 }] });
  assert.equal(r.status, 201); assert.equal(r.conferencia.itens[0].divergencia, -7);
  assert.equal(db.getProductById(12).quantidade_estoque, antes - 7);
  assert.equal((await f.post('/api/inventory', { observacao: 'Conferência quinzenal do estoque', itens: [{ id_produto: 1, quantidade_fisica: 2.5 }] })).status, 400);
  assert.ok((await f.get('/api/inventory')).conferencias.length >= 2);
});

test('Cenário 3: alerta de estoque crítico no dashboard', async () => {
  const f = await func();
  const d = (await f.get('/api/dashboard')).data;
  assert.ok(d.alertas.some(a => a.mensagem === 'Atenção: Farinha de Trigo Especial 1kg atingiu o estoque mínimo' || a.mensagem.startsWith('Atenção: ')));
  assert.equal(d.alertas.length, d.metricas.alertasCriticosCount);
});

test('Cenário 4 / RF 12-14: relatórios com filtros e exportação PDF e XLSX', async () => {
  const b = await back();
  const hoje = db.util.dataISO();
  let r = await b.get(`/api/reports/sales?from=${hoje}&to=${hoje}`);
  assert.ok(r.report.quantidadeTransacoes > 0);
  const soma = r.report.itensVendidos.reduce((a, i) => a + i.total, 0);
  assert.ok(Math.abs(soma - r.report.totalBruto) < 0.01);
  assert.equal((await b.get('/api/reports/sales?from=2000-01-01&to=2000-01-02')).report.itensVendidos.length, 0);
  assert.equal((await b.get('/api/reports/sales?from=2026-12-01&to=2026-01-01')).status, 400);
  const cat = (await b.get('/api/reports/sales?categoria=2')).report;
  assert.ok(cat.itensVendidos.every(i => i.categoria === 'Bebidas & Cafés'));
  const pdf = await b.raw(`/api/reports/sales?format=pdf&from=${hoje}&to=${hoje}`);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(pdf.buf.slice(0, 5).toString(), '%PDF-');
  const xlsx = await b.raw('/api/reports/stock?format=xlsx');
  assert.match(xlsx.headers.get('content-disposition'), /\.xlsx/); assert.equal(xlsx.buf.slice(0, 2).toString(), 'PK');
  const st = (await b.get('/api/reports/stock')).report;
  assert.ok(st.linhas.every(l => l.situacao === (l.saldo_atual <= l.estoque_minimo ? 'Crítico' : 'Regular')));
  assert.equal((await b.get('/api/reports/stock?format=doc')).status, 400);
});

test('Persistência e logs (RNF 06)', async () => {
  assert.ok(fs.existsSync(process.env.GESTFAST_DATA));
  const { Database } = db;
  const copia = new Database(process.env.GESTFAST_DATA);
  assert.equal(copia.vendas.length, db.vendas.length);
  const a = await admin();
  const logs = (await a.get('/api/logs')).logs;
  assert.ok(logs.some(l => l.evento === 'login') && logs.some(l => l.evento === 'login_falhou') && logs.some(l => l.evento === 'operacao'));
  assert.equal((await (await func()).get('/api/logs')).status, 403);
});

test('Recuperação de senha por link (fluxo de exceção IV)', async () => {
  const c = cliente();
  assert.equal((await c.post('/api/auth/forgot', { email: 'ninguem@x.com' })).status, 200);
  const r = db.createResetToken('henry@padarianovayork.com');
  assert.equal((await c.post('/api/auth/reset', { token: 'invalido', senha: 'novasenha1' })).status, 400);
  assert.equal((await c.post('/api/auth/reset', { token: r.token, senha: 'novasenha1' })).status, 200);
  assert.equal((await c.post('/api/auth/reset', { token: r.token, senha: 'outrasenha1' })).status, 400); // token de uso único
  await logar('henry@padarianovayork.com', 'novasenha1');
});

test('Busca global: encontra conteúdo e respeita o perfil', async () => {
  const a = await admin();
  let r = (await a.get('/api/search?q=pao')).results; // sem acento
  assert.ok(r.produtos.some(p => p.nome_produto === 'Pão Francês'));
  assert.ok((await a.get('/api/search?q=REQ-9661')).results.requisicoes.length >= 1);
  assert.ok((await a.get('/api/search?q=VENDA-100')).results.vendas.length >= 1);
  assert.ok((await a.get('/api/search?q=henry')).results.usuarios.length >= 1);
  assert.equal((await a.get('/api/search?q=p')).results.produtos.length, 0); // mínimo de 2 letras
  const f = await logar('henry@padarianovayork.com', 'novasenha1'); // senha trocada no teste de recuperação
  r = (await f.get('/api/search?q=henry')).results;
  assert.equal(r.usuarios.length, 0); // funcionário não vê a lista de usuários
  assert.equal((await cliente().get('/api/search?q=pao')).status, 401);
});
