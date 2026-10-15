// db.js - Camada de dados do GestFast ERP.
// Persistência em arquivo JSON (data/gestfast.json) com gravação atômica e transações com rollback.
// O modelo segue o script SQL do relatório (ver database/schema.sql).
'use strict';
const fs = require('fs');
const path = require('path');
const { erro } = require('./lib/errors');
const auth = require('./lib/auth');
const gateways = require('./lib/gateways');

const DATA_FILE = process.env.GESTFAST_DATA || path.join(__dirname, 'data', 'gestfast.json');

// ------------------------------------------------------------------ utilitários
const pad = n => String(n).padStart(2, '0');
const dataISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataHora = (d = new Date()) => `${dataISO(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const deslocar = (dias = 0, minutos = 0) => new Date(Date.now() + dias * 86400000 + minutos * 60000);
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r3 = n => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
const txt = v => (v === undefined || v === null ? '' : String(v).trim());
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalize(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Unidades que aceitam fração (peso/volume). As demais só aceitam quantidades inteiras.
const aceitaFracao = un => ['kg', 'lt', 'l'].includes(String(un || '').toLowerCase());

function validarQuantidade(prod, valor, rotulo = 'A quantidade') {
  const q = Number(valor);
  if (!Number.isFinite(q) || q <= 0) throw erro(`${rotulo} deve ser maior que zero.`);
  if (!aceitaFracao(prod.unidade) && !Number.isInteger(q)) {
    throw erro(`"${prod.nome_produto}" é controlado em ${prod.unidade} e só aceita quantidades inteiras.`);
  }
  return r3(q);
}

function validarTexto(valor, rotulo, { obrigatorio = false, min = 10, max = 5000 } = {}) {
  const t = txt(valor);
  if (!t) {
    if (obrigatorio) throw erro(`${rotulo} é obrigatório(a) e deve ter entre ${min} e ${max} caracteres.`);
    return '';
  }
  if (t.length < min || t.length > max) throw erro(`${rotulo} deve ter entre ${min} e ${max} caracteres.`);
  return t;
}

const PERSISTIDOS = ['perfis', 'usuarios', 'categorias', 'fornecedores', 'produtos', 'requisicoes', 'movimentacoes',
  'vendas', 'conferencias', 'alertas', 'relatorios', 'sessoes', 'tokensReset', 'configuracoes'];

const FORMAS_PAGAMENTO = ['Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'PIX'];
const SITUACOES_ABERTAS = ['Em Aberto', 'Cotado', 'AF Gerada'];

class Database {
  constructor(file = DATA_FILE) {
    this.file = file;
    this.load();
  }

  // ---------------------------------------------------------------- persistência
  load() {
    if (this.file !== ':memory:' && fs.existsSync(this.file)) {
      try {
        const dados = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        PERSISTIDOS.forEach(k => { if (dados[k] !== undefined) this[k] = dados[k]; });
        this.sincronizarAlertas();
        return;
      } catch (e) {
        fs.copyFileSync(this.file, `${this.file}.corrompido-${Date.now()}`);
      }
    }
    this.seed();
    this.save();
  }

  toJSON() {
    const o = {};
    PERSISTIDOS.forEach(k => { o[k] = this[k]; });
    return o;
  }

  save() {
    if (this.file === ':memory:') return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.toJSON()));
    fs.renameSync(tmp, this.file);
  }

  // Transação: se qualquer etapa falhar, nada é gravado (cenário 18 do relatório).
  tx(fn) {
    const snap = JSON.stringify(this.toJSON());
    try {
      const r = fn();
      this.sincronizarAlertas();
      this.save();
      return r;
    } catch (e) {
      const antigo = JSON.parse(snap);
      PERSISTIDOS.forEach(k => { this[k] = antigo[k]; });
      throw e;
    }
  }

  proxId(lista, campo) {
    return lista.length ? Math.max(...lista.map(i => i[campo])) + 1 : 1;
  }

  // ---------------------------------------------------------------- dados iniciais
  seed() {
    this.perfis = [
      { id_perfil: 1, nome_perfil: 'Administrador' },
      { id_perfil: 2, nome_perfil: 'BackOffice' },
      { id_perfil: 3, nome_perfil: 'Funcionario' }
    ];
    const hoje = dataISO();
    this.usuarios = [
      { id_usuario: 1, nome: 'Francisco', email: 'proprietario@padarianovayork.com', senha: auth.hashPassword('admin123'), cargo: 'Proprietário', status: 'Ativo', data_criacao: hoje, id_perfil: 1 },
      { id_usuario: 2, nome: 'Henry Sena', email: 'henry@padarianovayork.com', senha: auth.hashPassword('func123'), cargo: 'Atendente / Operador de Caixa', status: 'Ativo', data_criacao: hoje, id_perfil: 3 },
      { id_usuario: 3, nome: 'Equipe BackOffice', email: 'backoffice@padarianovayork.com', senha: auth.hashPassword('backoffice123'), cargo: 'BackOffice / Estoque', status: 'Ativo', data_criacao: hoje, id_perfil: 2 }
    ];
    this.categorias = [
      { id_categoria: 1, nome_categoria: 'Pães', descricao: 'Pães artesanais, franceses, baguetes e doces' },
      { id_categoria: 2, nome_categoria: 'Bebidas & Cafés', descricao: 'Cafés, sucos, refrigerantes e laticínios' },
      { id_categoria: 3, nome_categoria: 'Mercearia & Insumos', descricao: 'Farinhas, açúcares, fermentos e ingredientes' },
      { id_categoria: 4, nome_categoria: 'Confeitaria & Bolos', descricao: 'Bolos, doces, tortas e sobremesas' },
      { id_categoria: 5, nome_categoria: 'Frios & Derivados', descricao: 'Queijos, presuntos, manteigas e frios fatiados' }
    ];
    this.fornecedores = [
      'Empresa Pão e Açúcar Dist.', 'Moinho Paulista de Trigo', 'Granja Santo André Ltda', 'Laticínios ABC',
      'Confeitaria Doce Arte', 'Panificadora Central e Distribuição', 'Café Pilão Distribuição Direta',
      'Distribuidora de Embalagens São Caetano'
    ];
    const P = (id, cod, nome, desc, un, peso, custo, venda, min, max, qtd, emin, cat, lote, dias) => ({
      id_produto: id, codigo_barras: cod, nome_produto: nome, descricao: desc, unidade: un, peso,
      preco_custo: custo, preco_venda: venda, preco_min: min, preco_max: max, quantidade_estoque: qtd,
      estoque_minimo: emin, status: 'Ativo', id_categoria: cat, lote, validade: dataISO(deslocar(dias)), imagem: ''
    });
    this.produtos = [
      P(1, '78910001', 'Pão de Queijo', 'Pão de queijo tradicional de Minas 50g assado na hora', 'UN', '50g', 1.20, 3.50, 2.50, 5.00, 10, 30, 1, '546320', 3),
      P(2, '78910002', 'Café Pilão 320g', 'Café torrado e moído tradicional 320g com notas intensas', 'Pacote', '320g', 12.50, 18.90, 15.00, 22.00, 20, 25, 2, '548417', 120),
      P(3, '78910003', 'Bolo de Cenoura', 'Bolo caseiro de cenoura com calda generosa de chocolate', 'Fatia', '120g', 4.50, 12.00, 9.00, 16.00, 4, 12, 4, '546328', 2),
      P(4, '78910004', 'Pão Francês', 'Pão francês artesanal crocante assado de hora em hora', 'KG', '1000g', 5.50, 16.90, 14.00, 19.90, 70, 30, 1, '545846', 1),
      P(5, '78910005', 'Açúcar Cristal 1kg', 'Açúcar cristal refinado 1kg para receitas e café', 'Pacote', '1000g', 3.20, 5.50, 4.00, 7.00, 12, 20, 3, '546326', 200),
      P(6, '78910006', 'Farinha de Trigo Especial 1kg', 'Farinha de trigo tipo 1 para panificação profissional de alto padrão', 'Pacote', '1000g', 4.10, 6.80, 5.00, 8.50, 18, 40, 3, '547890', 90),
      P(7, '78910007', 'Queijo Mussarela Fatiado', 'Queijo mussarela fatiado fresco para lanches e salgados', 'KG', '1000g', 32.00, 48.00, 40.00, 56.00, 6, 15, 5, '549012', 7),
      P(8, '78910008', 'Leite Integral 1L', 'Leite UHT integral pasteurizado 1L', 'UN', '1000ml', 3.80, 6.00, 4.90, 7.50, 80, 30, 2, '548900', 20),
      P(9, '78910009', 'Ovos Brancos Granjeiros (Dúzia)', 'Dúzia de ovos brancos selecionados tipo grande de alta qualidade', 'DZ', '650g', 8.50, 15.00, 12.00, 18.00, 100, 35, 3, '549111', 12),
      P(10, '78910010', 'Suco de Uva Integral 500ml', 'Suco de uva tinto 100% natural sem adição de açúcares ou conservantes', 'UN', '500ml', 4.80, 8.00, 6.50, 10.00, 25, 15, 2, '578412', 150),
      P(11, '78910011', 'Pão Doce Tradicional', 'Pão doce fofinho com creme de baunilha artesanal e coco ralado', 'UN', '80g', 1.10, 3.20, 2.50, 4.00, 60, 20, 1, '548999', 1),
      P(12, '78910012', 'Bala Toffee Mastigável', 'Balas caramelizadas artesanais sortidas tradicionais da bomboniere', 'UN', '10g', 0.10, 0.30, 0.20, 0.50, 200, 50, 4, '546111', 180)
    ];

    const R = (id, forn, pn, idp, qp, qa, un, vu, sit, dPed, dPrev, obs, extra = {}) => ({
      id_requisicao: id, codigo_pedido: `REQ-${9660 + id}`, fornecedor: forn, produto_nome: pn, id_produto: idp,
      quantidade_pedida: qp, quantidade_atendida: qa, unidade: un, valor_unitario: vu, valor_total: r2(qp * vu),
      situacao: sit, data_pedido: dataISO(deslocar(dPed)), previsao_entrega: dataISO(deslocar(dPrev)),
      endereco_entrega: 'Padaria Nova York - Rua Visconde de Inhaúma, 450', observacao: obs,
      historico: [{ data: dataHora(deslocar(dPed)), situacao: 'Em Aberto', usuario: 'Henry Sena' }], ...extra
    });
    this.requisicoes = [
      R(6, 'Distribuidora de Embalagens São Caetano', 'Copos Descartáveis 200ml (Cento)', null, 20, 0, 'Pacote', 12.00, 'Cancelado', -11, -8, 'Pedido de embalagens para o balcão.',
        { justificativa_cancelamento: 'Cancelamento efetuado após a verificação física constatar saldo remanescente suficiente para mais 3 semanas no depósito.' }),
      R(5, 'Panificadora Central e Distribuição', 'Pão Francês', 4, 60, 60, 'KG', 5.50, 'Finalizado', -9, -8, 'Entregue com pontualidade e conferido integralmente pelo estoquista.'),
      R(4, 'Confeitaria Doce Arte', 'Bolo de Cenoura', 3, 30, 0, 'Fatia', 4.50, 'Em Aberto', -4, 1, 'Estoque atingiu nível crítico no balcão refrigerado.'),
      R(3, 'Moinho Paulista de Trigo', 'Farinha de Trigo Especial 1kg', 6, 50, 0, 'Pacote', 4.10, 'Cotado', -5, 3, 'Farinha com teor protéico ideal para a fornada diária de baguetes.'),
      R(2, 'Granja Santo André Ltda', 'Ovos Brancos Granjeiros (Dúzia)', 9, 100, 0, 'DZ', 8.50, 'Em Aberto', -5, 2, 'Reposição semanal de ovos para a produção contínua da confeitaria.'),
      R(1, 'Empresa Pão e Açúcar Dist.', 'Café Pilão 320g', 2, 50, 15, 'Pacote', 12.50, 'Em Aberto', -6, 1, 'Pedido prioritário de café moído para atender o fluxo matinal da padaria.')
    ].reverse();

    const M = (id, tipo, qtd, min, obs, idp, un, vu, idu, nomeUsr, orig) => {
      const p = this.produtos.find(x => x.id_produto === idp);
      return { id_movimentacao: id, tipo_movimentacao: tipo, quantidade: qtd, data_movimentacao: dataHora(deslocar(0, min)), observacao: obs,
        id_produto: idp, produto_nome: p.nome_produto, codigo_barras: p.codigo_barras, unidade: un, valor_unitario: vu,
        valor_total: r2(qtd * vu), id_usuario: idu, usuario_nome: nomeUsr, origem: orig };
    };
    this.movimentacoes = [
      M(3, 'Saída', 6, -420, 'Venda de Café Pilão para clientes do salão', 2, 'Pacote', 18.90, 2, 'Henry Sena', 'venda'),
      M(2, 'Saída', 15, -600, 'Vendas acumuladas do balcão de frios e lanches', 1, 'UN', 3.50, 2, 'Henry Sena', 'venda'),
      M(1, 'Entrada', 60, -900, 'Recebimento de lote do fornecedor Panificadora Central', 4, 'KG', 5.50, 1, 'Francisco', 'manual')
    ];

    const V = (id, min, forma, itens) => {
      const its = itens.map((i, ix) => ({ id_item_venda: ix + 1, ...i, subtotal: r2(i.quantidade * i.valor_unitario) }));
      const total = r2(its.reduce((a, i) => a + i.subtotal, 0));
      return {
        id_venda: id, codigo_venda: `VENDA-${1000 + id}`, data_venda: dataHora(deslocar(0, min)),
        valor_subtotal: total, desconto: 0, desconto_tipo: 'valor', valor_total: total, forma_pagamento: forma,
        status_venda: 'Concluída', id_usuario: 2, usuario_nome: 'Henry Sena', itens: its
      };
    };
    this.vendas = [
      V(6, -30, 'PIX', [{ id_produto: 10, nome_produto: 'Suco de Uva Integral 500ml', unidade: 'UN', quantidade: 12, valor_unitario: 8 }]),
      V(5, -60, 'Dinheiro', [{ id_produto: 4, nome_produto: 'Pão Francês', unidade: 'KG', quantidade: 6.5, valor_unitario: 16.9 }]),
      V(4, -90, 'Cartão Crédito', [{ id_produto: 9, nome_produto: 'Ovos Brancos Granjeiros (Dúzia)', unidade: 'DZ', quantidade: 30, valor_unitario: 15 }]),
      V(3, -120, 'PIX', [{ id_produto: 8, nome_produto: 'Leite Integral 1L', unidade: 'UN', quantidade: 20, valor_unitario: 6 }]),
      V(2, -150, 'Dinheiro', [{ id_produto: 11, nome_produto: 'Pão Doce Tradicional', unidade: 'UN', quantidade: 37, valor_unitario: 3.2 }]),
      V(1, -180, 'Cartão Débito', [{ id_produto: 2, nome_produto: 'Café Pilão 320g', unidade: 'Pacote', quantidade: 5, valor_unitario: 18 }])
    ];

    this.conferencias = [{
      id_conferencia: 1, data_conferencia: dataHora(deslocar(-3)), responsavel: 'Henry Sena', id_usuario: 2,
      observacao: 'Conferência de estoque físico e ajuste de saldos.',
      itens: [
        { id_produto: 5, nome_produto: 'Açúcar Cristal 1kg', unidade: 'Pacote', lote: '546326', quantidade_sistema: 12, quantidade_fisica: 12, divergencia: 0 },
        { id_produto: 2, nome_produto: 'Café Pilão 320g', unidade: 'Pacote', lote: '548417', quantidade_sistema: 25, quantidade_fisica: 25, divergencia: 0 },
        { id_produto: 4, nome_produto: 'Pão Francês', unidade: 'KG', lote: '545846', quantidade_sistema: 70, quantidade_fisica: 68, divergencia: -2 }
      ]
    }];
    this.alertas = [];
    this.relatorios = [];
    this.sessoes = [];
    this.tokensReset = [];
    this.configuracoes = {
      estabelecimento: 'Padaria Nova York - São Caetano do Sul (SP)',
      descontoMaximoPercent: 20,
      intervaloAtualizacaoSeg: 3,
      simularCartaoNegado: false,
      simularFornecedorIndisponivel: false
    };
    this.sincronizarAlertas();
  }

  // ---------------------------------------------------------------- configurações
  getSettings() { return { ...this.configuracoes }; }

  updateSettings(d) {
    return this.tx(() => {
      const c = this.configuracoes;
      if (d.estabelecimento !== undefined) {
        const e = txt(d.estabelecimento);
        if (e.length < 3 || e.length > 150) throw erro('O nome do estabelecimento deve ter entre 3 e 150 caracteres.');
        c.estabelecimento = e;
      }
      if (d.descontoMaximoPercent !== undefined) {
        const n = Number(d.descontoMaximoPercent);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw erro('O desconto máximo deve estar entre 0% e 100%.');
        c.descontoMaximoPercent = n;
      }
      if (d.intervaloAtualizacaoSeg !== undefined) {
        const n = Number(d.intervaloAtualizacaoSeg);
        if (!Number.isFinite(n) || n < 2 || n > 60) throw erro('O intervalo de atualização deve estar entre 2 e 60 segundos.');
        c.intervaloAtualizacaoSeg = n;
      }
      ['simularCartaoNegado', 'simularFornecedorIndisponivel'].forEach(k => { if (d[k] !== undefined) c[k] = !!d[k]; });
      return this.getSettings();
    });
  }

  // ---------------------------------------------------------------- usuários, sessões e login
  nomePerfil(id) { return (this.perfis.find(p => p.id_perfil === Number(id)) || {}).nome_perfil || ''; }

  publicUser(u) {
    if (!u) return null;
    const { senha, ...resto } = u;
    return { ...resto, perfil: this.nomePerfil(u.id_perfil) };
  }

  getUserById(id) { return this.usuarios.find(u => u.id_usuario === Number(id)); }
  getUserByEmail(email) { return this.usuarios.find(u => normalize(u.email) === normalize(txt(email))); }

  authenticate(email, senha) {
    if (!txt(email) || !senha) throw erro('Informe o e-mail e a senha.');
    const u = this.getUserByEmail(email);
    if (!u || !auth.verifyPassword(senha, u.senha)) throw erro('E-mail ou senha incorretos', 401);
    if (u.status !== 'Ativo') throw erro('Sua conta está inativa. Entre em contato com o administrador', 403);
    return u;
  }

  // Autorização de gerente (cancelamento de vendas): exige credenciais de Administrador ou BackOffice.
  authorizeManager(email, senha, aceitos = ['Administrador', 'BackOffice']) {
    const u = this.getUserByEmail(email);
    if (!u || u.status !== 'Ativo' || !auth.verifyPassword(senha || '', u.senha) || !aceitos.includes(this.nomePerfil(u.id_perfil))) {
      throw erro('Autorização negada: informe e-mail e senha de um perfil gerente válido.', 403);
    }
    return u;
  }

  createSession(idUsuario, lembrar) {
    const token = auth.newToken();
    const agora = Date.now();
    this.sessoes = this.sessoes.filter(s => s.expira > agora);
    this.sessoes.push({
      hash: auth.hashToken(token), id_usuario: idUsuario, lembrar: !!lembrar, criado: agora,
      expira: agora + (lembrar ? 30 * 86400000 : 8 * 3600000)
    });
    this.save();
    return { token, maxAgeSeg: lembrar ? 30 * 86400 : null };
  }

  getSessionUser(token) {
    if (!token) return null;
    const h = auth.hashToken(token);
    const s = this.sessoes.find(x => x.hash === h && x.expira > Date.now());
    if (!s) return null;
    const u = this.getUserById(s.id_usuario);
    return u && u.status === 'Ativo' ? u : null;
  }

  deleteSession(token) {
    if (!token) return;
    const h = auth.hashToken(token);
    this.sessoes = this.sessoes.filter(s => s.hash !== h);
    this.save();
  }

  changePassword(id, atual, nova) {
    return this.tx(() => {
      const u = this.getUserById(id);
      if (!u || !auth.verifyPassword(atual || '', u.senha)) throw erro('A senha atual está incorreta.');
      this.validarSenha(nova);
      u.senha = auth.hashPassword(nova);
      return true;
    });
  }

  validarSenha(s) {
    if (!s || String(s).length < 6 || String(s).length > 100) throw erro('A senha deve ter entre 6 e 100 caracteres.');
  }

  createResetToken(email) {
    const u = this.getUserByEmail(email);
    if (!u || u.status !== 'Ativo') return null;
    const token = auth.newToken();
    this.tokensReset = this.tokensReset.filter(t => t.expira > Date.now() && t.id_usuario !== u.id_usuario);
    this.tokensReset.push({ hash: auth.hashToken(token), id_usuario: u.id_usuario, expira: Date.now() + 30 * 60000 });
    this.save();
    return { token, user: u };
  }

  resetPassword(token, nova) {
    return this.tx(() => {
      const h = auth.hashToken(token || '');
      const t = this.tokensReset.find(x => x.hash === h && x.expira > Date.now());
      if (!t) throw erro('O link de redefinição é inválido ou expirou.');
      this.validarSenha(nova);
      const u = this.getUserById(t.id_usuario);
      u.senha = auth.hashPassword(nova);
      this.tokensReset = this.tokensReset.filter(x => x !== t);
      this.sessoes = this.sessoes.filter(s => s.id_usuario !== u.id_usuario);
      return u;
    });
  }

  listUsers({ q, id_perfil, status } = {}) {
    let list = this.usuarios;
    if (id_perfil) list = list.filter(u => u.id_perfil === Number(id_perfil));
    if (status) list = list.filter(u => u.status === status);
    if (q) {
      const t = normalize(q);
      list = list.filter(u => normalize(u.nome).includes(t) || normalize(u.email).includes(t) || normalize(u.cargo).includes(t));
    }
    return list.map(u => this.publicUser(u));
  }

  adminsAtivos(excluindoId) {
    return this.usuarios.filter(u => u.status === 'Ativo' && this.nomePerfil(u.id_perfil) === 'Administrador' && u.id_usuario !== Number(excluindoId));
  }

  createUser(d) {
    return this.tx(() => {
      const nome = txt(d.nome), email = txt(d.email).toLowerCase();
      if (nome.length < 2 || nome.length > 150) throw erro('Informe o nome do funcionário (2 a 150 caracteres).');
      if (!EMAIL_RE.test(email)) throw erro('Informe um login (e-mail) válido.');
      this.validarSenha(d.senha);
      if (!this.perfis.some(p => p.id_perfil === Number(d.id_perfil))) throw erro('Selecione um perfil de acesso válido.');
      if (this.getUserByEmail(email)) throw erro('O login informado já está em uso. Informe outro identificador.');
      const u = {
        id_usuario: this.proxId(this.usuarios, 'id_usuario'), nome, email, senha: auth.hashPassword(d.senha),
        cargo: txt(d.cargo).slice(0, 100), status: 'Ativo', data_criacao: dataISO(), id_perfil: Number(d.id_perfil)
      };
      this.usuarios.push(u);
      return this.publicUser(u);
    });
  }

  updateUser(id, d, ator) {
    return this.tx(() => {
      const u = this.getUserById(id);
      if (!u) throw erro('Funcionário não encontrado.', 404);
      if (d.nome !== undefined) {
        const nome = txt(d.nome);
        if (nome.length < 2 || nome.length > 150) throw erro('Informe o nome do funcionário (2 a 150 caracteres).');
        u.nome = nome;
      }
      if (d.email !== undefined) {
        const email = txt(d.email).toLowerCase();
        if (!EMAIL_RE.test(email)) throw erro('Informe um login (e-mail) válido.');
        const outro = this.getUserByEmail(email);
        if (outro && outro.id_usuario !== u.id_usuario) throw erro('O login informado já está em uso. Informe outro identificador.');
        u.email = email;
      }
      if (d.cargo !== undefined) u.cargo = txt(d.cargo).slice(0, 100);
      if (d.id_perfil !== undefined && Number(d.id_perfil) !== u.id_perfil) {
        if (!this.perfis.some(p => p.id_perfil === Number(d.id_perfil))) throw erro('Selecione um perfil de acesso válido.');
        if (this.nomePerfil(u.id_perfil) === 'Administrador' && u.status === 'Ativo' && !this.adminsAtivos(u.id_usuario).length) {
          throw erro('Não é possível remover o perfil do único Administrador ativo.');
        }
        u.id_perfil = Number(d.id_perfil);
      }
      if (d.senha) {
        this.validarSenha(d.senha);
        u.senha = auth.hashPassword(d.senha);
        this.sessoes = this.sessoes.filter(s => s.id_usuario !== u.id_usuario || (ator && s.id_usuario === ator.id_usuario));
      }
      return this.publicUser(u);
    });
  }

  setUserStatus(id, status, ator) {
    return this.tx(() => {
      const u = this.getUserById(id);
      if (!u) throw erro('Funcionário não encontrado.', 404);
      if (!['Ativo', 'Inativo'].includes(status)) throw erro('Situação inválida.');
      if (status === 'Inativo') {
        if (ator && ator.id_usuario === u.id_usuario) throw erro('Você não pode desativar o seu próprio acesso.');
        if (this.nomePerfil(u.id_perfil) === 'Administrador' && !this.adminsAtivos(u.id_usuario).length) {
          throw erro('Não é possível desativar o único Administrador ativo.');
        }
        this.sessoes = this.sessoes.filter(s => s.id_usuario !== u.id_usuario);
      }
      u.status = status;
      return this.publicUser(u);
    });
  }

  // ---------------------------------------------------------------- produtos
  getProducts(query, categoriaId, status = 'Ativo') {
    let list = this.produtos.slice();
    if (status === 'Inativo') list = list.filter(p => p.status === 'Inativo');
    else if (status !== 'todos') list = list.filter(p => p.status !== 'Inativo');
    if (categoriaId) list = list.filter(p => p.id_categoria === Number(categoriaId));
    if (query) {
      const t = normalize(query);
      list = list.filter(p => normalize(p.nome_produto).includes(t) || normalize(p.codigo_barras).includes(t) || normalize(p.descricao).includes(t));
    }
    return list;
  }

  getProductById(id) { return this.produtos.find(p => p.id_produto === Number(id)); }

  validarProduto(data, existente) {
    const nome = txt(data.nome_produto);
    if (nome.length < 2 || nome.length > 200) throw erro('Informe o nome do produto (2 a 200 caracteres).');
    const venda = Number(data.preco_venda);
    if (!Number.isFinite(venda) || venda <= 0) throw erro('O preço de venda deve ser maior que zero.');
    const vazio = v => v === '' || v === undefined || v === null;
    const custo = vazio(data.preco_custo) ? 0 : Number(data.preco_custo);
    if (!Number.isFinite(custo) || custo < 0) throw erro('O preço de custo não pode ser negativo.');
    const min = vazio(data.preco_min) ? r2(venda * 0.8) : Number(data.preco_min);
    const max = vazio(data.preco_max) ? r2(venda * 1.3) : Number(data.preco_max);
    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max <= 0) throw erro('Os preços mínimo e máximo são inválidos.');
    if (min > venda || venda > max) throw erro('O preço de venda deve estar entre o preço mínimo e o preço máximo.');
    const emin = vazio(data.estoque_minimo) ? 10 : Number(data.estoque_minimo);
    if (!Number.isFinite(emin) || emin < 0) throw erro('O estoque mínimo deve ser um número maior ou igual a zero.');
    const qtd = vazio(data.quantidade_estoque) ? (existente ? existente.quantidade_estoque : 0) : Number(data.quantidade_estoque);
    if (!Number.isFinite(qtd) || qtd < 0) throw erro('O estoque atual não pode ser negativo.');
    const unidade = txt(data.unidade) || (existente ? existente.unidade : 'UN');
    if (!aceitaFracao(unidade) && !Number.isInteger(qtd)) throw erro(`Produtos em ${unidade} só aceitam estoque inteiro.`);
    if (!aceitaFracao(unidade) && !Number.isInteger(emin)) throw erro(`Produtos em ${unidade} só aceitam estoque mínimo inteiro.`);
    const cat = Number(data.id_categoria);
    if (!this.categorias.some(c => c.id_categoria === cat)) throw erro('Selecione uma categoria válida.');
    const descricao = validarTexto(data.descricao, 'A descrição do produto', { min: 10, max: 5000 });
    const validade = txt(data.validade);
    if (validade && !DATA_RE.test(validade)) throw erro('A data de validade é inválida.');
    return { nome, venda: r2(venda), custo: r2(custo), min: r2(min), max: r2(max), emin: r3(emin), qtd: r3(qtd), unidade, cat, descricao, validade };
  }

  saveProduct(data) {
    return this.tx(() => {
      const existente = data.id_produto ? this.getProductById(data.id_produto) : null;
      if (data.id_produto && !existente) throw erro('Produto não encontrado.', 404);
      const v = this.validarProduto(data, existente);
      let cod = txt(data.codigo_barras);
      if (cod && this.produtos.some(p => p.codigo_barras === cod && (!existente || p.id_produto !== existente.id_produto))) {
        throw erro(`O código "${cod}" já está cadastrado em outro produto.`);
      }
      const campos = {
        nome_produto: v.nome, descricao: v.descricao, unidade: v.unidade, peso: txt(data.peso),
        preco_custo: v.custo, preco_venda: v.venda, preco_min: v.min, preco_max: v.max, quantidade_estoque: v.qtd,
        estoque_minimo: v.emin, id_categoria: v.cat, lote: txt(data.lote), validade: v.validade
      };
      if (data.imagem !== undefined) campos.imagem = txt(data.imagem);
      if (existente) {
        if (cod) existente.codigo_barras = cod;
        Object.assign(existente, campos);
        if (!existente.lote) existente.lote = '-';
        return existente;
      }
      const id = this.proxId(this.produtos, 'id_produto');
      if (!cod) {
        cod = `789100${String(id).padStart(2, '0')}`;
        while (this.produtos.some(p => p.codigo_barras === cod)) cod += '1';
      }
      const novo = {
        id_produto: id, codigo_barras: cod, status: 'Ativo', imagem: '', ...campos,
        lote: campos.lote || `L-${Math.floor(100000 + Math.random() * 900000)}`
      };
      this.produtos.push(novo);
      return novo;
    });
  }

  setProductStatus(id, status) {
    return this.tx(() => {
      const p = this.getProductById(id);
      if (!p) throw erro('Produto não encontrado.', 404);
      if (!['Ativo', 'Inativo'].includes(status)) throw erro('Situação inválida.');
      if (p.status === status) throw erro(status === 'Inativo' ? 'Este produto já está inativo.' : 'Este produto já está ativo.');
      p.status = status;
      return p;
    });
  }

  // ---------------------------------------------------------------- alertas de estoque (RF 11)
  sincronizarAlertas() {
    if (!this.alertas) this.alertas = [];
    for (const p of this.produtos) {
      const ativo = this.alertas.find(a => a.id_produto === p.id_produto && a.status_alerta === 'Ativo');
      const critico = p.status === 'Ativo' && Number(p.quantidade_estoque) <= Number(p.estoque_minimo);
      if (critico && !ativo) {
        this.alertas.push({
          id_alerta: this.proxId(this.alertas, 'id_alerta'), data_alerta: dataHora(),
          mensagem: `Atenção: ${p.nome_produto} atingiu o estoque mínimo`, status_alerta: 'Ativo', id_produto: p.id_produto
        });
      } else if (!critico && ativo) {
        ativo.status_alerta = 'Resolvido';
      }
    }
    if (this.alertas.length > 500) this.alertas = this.alertas.slice(-500);
  }

  getAlertasCriticos() {
    return this.alertas.filter(a => a.status_alerta === 'Ativo').map(a => {
      const p = this.getProductById(a.id_produto);
      return {
        id_alerta: a.id_alerta, id_produto: p.id_produto, nome_produto: p.nome_produto, unidade: p.unidade,
        quantidade_estoque: p.quantidade_estoque, estoque_minimo: p.estoque_minimo, lote: p.lote,
        categoria_id: p.id_categoria, data_alerta: a.data_alerta, mensagem: a.mensagem
      };
    });
  }

  // ---------------------------------------------------------------- dashboard (RF 10)
  getDashboardData(usuario) {
    const ativos = this.produtos.filter(p => p.status === 'Ativo');
    const alertas = this.getAlertasCriticos();
    const totalEmEstoque = ativos.reduce((a, p) => a + Number(p.quantidade_estoque), 0);
    const hoje = dataISO();
    const vendasHoje = this.vendas.filter(v => v.status_venda === 'Concluída' && v.data_venda.slice(0, 10) === hoje);
    const faturamentoHoje = vendasHoje.reduce((a, v) => a + v.valor_total, 0);
    const limiteVal = dataISO(deslocar(3));
    const categoriasMap = {};
    this.categorias.forEach(c => { categoriasMap[c.id_categoria] = { nome: c.nome_categoria, total: 0 }; });
    ativos.forEach(p => { if (categoriasMap[p.id_categoria]) categoriasMap[p.id_categoria].total += Number(p.quantidade_estoque); });
    return {
      usuarioAtivo: this.publicUser(usuario),
      metricas: {
        totalProdutos: ativos.length,
        alertasCriticosCount: alertas.length,
        totalItensEstoque: r3(totalEmEstoque),
        requisicoesAbertasCount: this.requisicoes.filter(r => SITUACOES_ABERTAS.includes(r.situacao)).length,
        totalVendasHoje: r2(faturamentoHoje).toFixed(2),
        vendasHojeCount: vendasHoje.length,
        ticketMedioHoje: vendasHoje.length ? r2(faturamentoHoje / vendasHoje.length).toFixed(2) : '0.00',
        produtosVencendoCount: ativos.filter(p => p.validade && p.validade <= limiteVal).length
      },
      alertas,
      ultimasCompras: this.requisicoes.slice(0, 6),
      distribuicaoEstoque: Object.values(categoriasMap).filter(i => i.total > 0).map(i => ({
        categoria: i.nome, quantidade: r3(i.total),
        porcentagem: totalEmEstoque > 0 ? ((i.total / totalEmEstoque) * 100).toFixed(1) : '0'
      }))
    };
  }

  // ---------------------------------------------------------------- requisições de compra (RF 05)
  createRequisicao(data, ator) {
    return this.tx(() => {
      if (!data.fornecedor || !this.fornecedores.includes(data.fornecedor)) throw erro('Selecione um fornecedor da lista.');
      const prod = data.id_produto ? this.getProductById(data.id_produto) : null;
      if (data.id_produto && !prod) throw erro('Produto não encontrado.', 404);
      const nomeProd = prod ? prod.nome_produto : txt(data.produto_nome);
      if (!nomeProd) throw erro('O nome do produto é obrigatório.');
      const qtd = Number(data.quantidade_pedida);
      if (!Number.isFinite(qtd) || qtd <= 0) throw erro('A quantidade pedida deve ser maior que zero.');
      const un = prod ? prod.unidade : (txt(data.unidade) || 'UN');
      if (!aceitaFracao(un) && !Number.isInteger(qtd)) throw erro(`A unidade ${un} só aceita quantidades inteiras.`);
      const vu = data.valor_unitario === '' || data.valor_unitario === undefined ? (prod ? prod.preco_custo : 0) : Number(data.valor_unitario);
      if (!Number.isFinite(vu) || vu < 0) throw erro('O preço unitário é inválido.');
      const prev = txt(data.previsao_entrega) || dataISO(deslocar(4));
      if (!DATA_RE.test(prev) || prev < dataISO()) throw erro('A previsão de entrega deve ser uma data a partir de hoje.');
      const obs = validarTexto(data.observacao, 'A observação da requisição', { min: 10, max: 5000 });
      gateways.comunicarFornecedor('PEDIDO', data, this.configuracoes);
      const id = this.proxId(this.requisicoes, 'id_requisicao');
      const req = {
        id_requisicao: id, codigo_pedido: `REQ-${9660 + id}`, fornecedor: data.fornecedor, produto_nome: nomeProd,
        id_produto: prod ? prod.id_produto : null, quantidade_pedida: r3(qtd), quantidade_atendida: 0, unidade: un,
        valor_unitario: r2(vu), valor_total: r2(qtd * vu), situacao: 'Em Aberto', data_pedido: dataISO(),
        previsao_entrega: prev, endereco_entrega: txt(data.endereco_entrega) || 'Padrão - Padaria Nova York', observacao: obs,
        historico: [{ data: dataHora(), situacao: 'Em Aberto', usuario: ator ? ator.nome : '-' }]
      };
      this.requisicoes.unshift(req);
      return req;
    });
  }

  getRequisicao(id) { return this.requisicoes.find(r => r.id_requisicao === Number(id)); }

  updateRequisicaoStatus(id, body, ator) {
    return this.tx(() => {
      const req = this.getRequisicao(id);
      if (!req) throw erro('Requisição não encontrada.', 404);
      const nova = body.situacao;
      const registrar = sit => req.historico.push({ data: dataHora(), situacao: sit, usuario: ator ? ator.nome : '-' });
      if (!['Cotado', 'AF Gerada', 'Cancelado', 'Finalizado'].includes(nova)) throw erro('Situação inválida.');
      if (!SITUACOES_ABERTAS.includes(req.situacao)) throw erro(`A requisição já está "${req.situacao}" e não pode mais ser alterada.`);

      if (nova === 'Cotado') {
        if (req.situacao !== 'Em Aberto') throw erro('Somente requisições em aberto podem ser cotadas.');
        req.situacao = 'Cotado'; registrar('Cotado');
      } else if (nova === 'AF Gerada') {
        if (req.situacao === 'AF Gerada') throw erro('A Autorização de Fornecimento já foi gerada.');
        req.situacao = 'AF Gerada'; registrar('AF Gerada');
      } else if (nova === 'Cancelado') {
        req.justificativa_cancelamento = validarTexto(body.justificativa, 'O motivo do cancelamento', { obrigatorio: true });
        gateways.comunicarFornecedor('CANCELAMENTO', req, this.configuracoes);
        req.situacao = 'Cancelado'; registrar('Cancelado');
      } else {
        const restante = r3(req.quantidade_pedida - req.quantidade_atendida);
        const recebida = body.quantidade_recebida === undefined || body.quantidade_recebida === '' ? restante : Number(body.quantidade_recebida);
        if (!Number.isFinite(recebida) || recebida <= 0) throw erro('Informe a quantidade recebida (maior que zero).');
        if (recebida > restante) throw erro(`A quantidade recebida (${recebida}) excede o saldo pendente do pedido (${restante}).`);
        if (!aceitaFracao(req.unidade) && !Number.isInteger(recebida)) throw erro(`A unidade ${req.unidade} só aceita quantidades inteiras.`);
        const prod = req.id_produto ? this.getProductById(req.id_produto) : null;
        if (prod) {
          prod.quantidade_estoque = r3(prod.quantidade_estoque + recebida);
          this.addMovimentacao({
            tipo_movimentacao: 'Entrada', quantidade: recebida, origem: 'requisicao',
            observacao: `Entrada automática por recebimento da requisição ${req.codigo_pedido} (${req.fornecedor})`,
            id_produto: prod.id_produto, valor_unitario: req.valor_unitario
          }, ator);
        }
        req.quantidade_atendida = r3(req.quantidade_atendida + recebida);
        if (req.quantidade_atendida >= req.quantidade_pedida) { req.situacao = 'Finalizado'; registrar('Finalizado'); }
        else req.historico.push({ data: dataHora(), situacao: `Recebimento parcial (${recebida} ${req.unidade})`, usuario: ator ? ator.nome : '-' });
        req.parcial = req.situacao !== 'Finalizado';
      }
      return req;
    });
  }

  // ---------------------------------------------------------------- movimentações de estoque (RF 04)
  addMovimentacao(data, ator) {
    const prod = this.getProductById(data.id_produto);
    const vu = data.valor_unitario !== undefined ? Number(data.valor_unitario) : (data.tipo_movimentacao === 'Saída' ? prod.preco_venda : prod.preco_custo);
    const mov = {
      id_movimentacao: this.proxId(this.movimentacoes, 'id_movimentacao'),
      tipo_movimentacao: data.tipo_movimentacao, quantidade: r3(data.quantidade), data_movimentacao: dataHora(),
      observacao: data.observacao || '', id_produto: prod.id_produto, produto_nome: prod.nome_produto,
      codigo_barras: prod.codigo_barras, unidade: prod.unidade, valor_unitario: r2(vu), valor_total: r2(data.quantidade * vu),
      id_usuario: ator ? ator.id_usuario : null, usuario_nome: ator ? ator.nome : 'Sistema', origem: data.origem || 'manual'
    };
    this.movimentacoes.unshift(mov);
    return mov;
  }

  // Registra uma ou várias movimentações de uma só vez (individual ou em lote).
  registrarMovimentacoes(body, ator) {
    return this.tx(() => {
      const tipo = body.tipo_movimentacao;
      if (!['Entrada', 'Saída'].includes(tipo)) throw erro('Tipo de movimentação inválido.');
      const itens = Array.isArray(body.itens) ? body.itens : [{ id_produto: body.id_produto, quantidade: body.quantidade }];
      if (!itens.length) throw erro('Informe ao menos um item.');
      const obs = validarTexto(body.observacao, 'O motivo da movimentação', { obrigatorio: true });
      const acumulado = new Map();
      for (const it of itens) {
        const prod = this.getProductById(it.id_produto);
        if (!prod) throw erro('Produto não cadastrado.', 404);
        const q = validarQuantidade(prod, it.quantidade);
        acumulado.set(prod.id_produto, r3((acumulado.get(prod.id_produto) || 0) + q));
      }
      const movs = [];
      for (const [idp, qtd] of acumulado) {
        const prod = this.getProductById(idp);
        if (tipo === 'Saída') {
          if (prod.quantidade_estoque < qtd) throw erro(`Estoque insuficiente de "${prod.nome_produto}"! Saldo disponível: ${prod.quantidade_estoque} ${prod.unidade}.`);
          prod.quantidade_estoque = r3(prod.quantidade_estoque - qtd);
        } else prod.quantidade_estoque = r3(prod.quantidade_estoque + qtd);
        movs.push(this.addMovimentacao({ tipo_movimentacao: tipo, quantidade: qtd, observacao: obs, id_produto: idp }, ator));
      }
      return movs;
    });
  }

  getMovimentacoes({ tipo, from, to } = {}) {
    return this.movimentacoes.filter(m => {
      const d = m.data_movimentacao.slice(0, 10);
      return (!tipo || m.tipo_movimentacao.toLowerCase() === tipo.toLowerCase()) && (!from || d >= from) && (!to || d <= to);
    });
  }

  // ---------------------------------------------------------------- vendas (RF 07, 08, 09)
  resolverDesconto(subtotal, d, ator) {
    const tipo = d.desconto_tipo === 'percentual' ? 'percentual' : 'valor';
    const bruto = d.desconto === '' || d.desconto === undefined || d.desconto === null ? 0 : Number(d.desconto);
    if (!Number.isFinite(bruto) || bruto < 0) throw erro('O desconto informado é inválido.');
    if (tipo === 'percentual' && bruto > 100) throw erro('O desconto percentual não pode passar de 100%.');
    const valor = tipo === 'percentual' ? r2(subtotal * bruto / 100) : r2(bruto);
    if (valor > subtotal) throw erro('O desconto não pode ser maior que o subtotal da venda.');
    const max = this.configuracoes.descontoMaximoPercent;
    const admin = ator && this.nomePerfil(ator.id_perfil) === 'Administrador';
    if (!admin && subtotal > 0 && (valor / subtotal) * 100 > max + 1e-9) {
      throw erro(`Desconto acima do limite permitido (${max}% do subtotal).`);
    }
    return { tipo, valor };
  }

  realizarVenda(data, ator) {
    return this.tx(() => {
      const itens = Array.isArray(data.itens) ? data.itens : [];
      if (!itens.length) throw erro('Nenhum item inserido na venda.');
      const forma = data.forma_pagamento || 'Dinheiro';
      if (!FORMAS_PAGAMENTO.includes(forma)) throw erro('Forma de pagamento inválida.');

      const linhas = new Map();
      for (const it of itens) {
        const prod = this.getProductById(it.id_produto);
        if (!prod) throw erro('Produto não cadastrado.', 404);
        if (prod.status !== 'Ativo') throw erro(`"${prod.nome_produto}" está inativo e não pode ser vendido.`);
        const q = validarQuantidade(prod, it.quantidade);
        const preco = it.valor_unitario === undefined || it.valor_unitario === '' ? prod.preco_venda : Number(it.valor_unitario);
        if (!Number.isFinite(preco) || preco <= 0) throw erro('Preço unitário inválido.');
        if (preco < prod.preco_min || preco > prod.preco_max) {
          throw erro(`O preço de "${prod.nome_produto}" deve ficar entre R$ ${prod.preco_min.toFixed(2)} e R$ ${prod.preco_max.toFixed(2)}.`);
        }
        const chave = `${prod.id_produto}|${preco}`;
        const l = linhas.get(chave) || { prod, preco: r2(preco), qtd: 0 };
        l.qtd = r3(l.qtd + q);
        linhas.set(chave, l);
      }
      const totalPorProduto = new Map();
      for (const l of linhas.values()) totalPorProduto.set(l.prod.id_produto, r3((totalPorProduto.get(l.prod.id_produto) || 0) + l.qtd));
      for (const [idp, q] of totalPorProduto) {
        const p = this.getProductById(idp);
        if (p.quantidade_estoque < q) throw erro(`Quantidade indisponível em estoque para "${p.nome_produto}"! Solicitado: ${q}, em estoque: ${p.quantidade_estoque} ${p.unidade}.`);
      }

      const id = this.proxId(this.vendas, 'id_venda');
      const codigo = `VENDA-${1000 + id}`;
      const itensProc = [];
      let subtotal = 0;
      for (const l of linhas.values()) {
        const sub = r2(l.qtd * l.preco);
        subtotal = r2(subtotal + sub);
        itensProc.push({ id_item_venda: itensProc.length + 1, id_produto: l.prod.id_produto, nome_produto: l.prod.nome_produto, unidade: l.prod.unidade, quantidade: l.qtd, valor_unitario: l.preco, subtotal: sub });
      }
      const desc = this.resolverDesconto(subtotal, data, ator);
      const total = r2(subtotal - desc.valor);

      let recebido = null, troco = null;
      if (forma === 'Dinheiro' && data.valor_recebido !== undefined && data.valor_recebido !== '' && data.valor_recebido !== null) {
        recebido = Number(data.valor_recebido);
        if (!Number.isFinite(recebido) || recebido < total) throw erro('O valor recebido é menor que o total da venda.');
        troco = r2(recebido - total);
      }
      const aut = gateways.autorizarPagamento(forma, total, this.configuracoes);

      for (const it of itensProc) {
        const p = this.getProductById(it.id_produto);
        p.quantidade_estoque = r3(p.quantidade_estoque - it.quantidade);
        this.addMovimentacao({ tipo_movimentacao: 'Saída', quantidade: it.quantidade, origem: 'venda', observacao: `Baixa automática da ${codigo}`, id_produto: p.id_produto, valor_unitario: it.valor_unitario }, ator);
      }
      const venda = {
        id_venda: id, codigo_venda: codigo, data_venda: dataHora(), valor_subtotal: subtotal, desconto: desc.valor,
        desconto_tipo: desc.tipo, desconto_informado: Number(data.desconto) || 0, valor_total: total, forma_pagamento: forma,
        valor_recebido: recebido, troco, nsu: forma.startsWith('Cartão') ? aut.nsu : null,
        status_venda: 'Concluída', id_usuario: ator.id_usuario, usuario_nome: ator.nome, itens: itensProc
      };
      this.vendas.unshift(venda);
      return venda;
    });
  }

  getVenda(id) { return this.vendas.find(v => v.id_venda === Number(id)); }

  getVendas({ from, to, q, status } = {}) {
    const t = q ? normalize(q) : '';
    return this.vendas.filter(v => {
      const d = v.data_venda.slice(0, 10);
      return (!from || d >= from) && (!to || d <= to) && (!status || v.status_venda === status) &&
        (!t || normalize(v.codigo_venda).includes(t) || normalize(v.usuario_nome).includes(t) || v.itens.some(i => normalize(i.nome_produto).includes(t)));
    }).slice().sort((a, b) => b.id_venda - a.id_venda);
  }

  estornarItensVenda(venda, ator, motivo) {
    venda.itens.forEach(item => {
      const p = this.getProductById(item.id_produto);
      if (!p) return;
      p.quantidade_estoque = r3(p.quantidade_estoque + item.quantidade);
      this.addMovimentacao({ tipo_movimentacao: 'Entrada', quantidade: item.quantidade, origem: 'estorno', observacao: `${motivo} (${venda.codigo_venda})`, id_produto: p.id_produto, valor_unitario: item.valor_unitario }, ator);
    });
  }

  cancelarVenda(id, body, ator, autorizador) {
    return this.tx(() => {
      const venda = this.getVenda(id);
      if (!venda) throw erro('Venda não encontrada.', 404);
      if (venda.status_venda === 'Cancelada') throw erro('Esta venda já está cancelada.');
      const motivo = validarTexto(body.motivo, 'O motivo do cancelamento', { obrigatorio: true });
      this.estornarItensVenda(venda, ator, 'Estorno de estoque por cancelamento');
      venda.status_venda = 'Cancelada';
      venda.motivo_cancelamento = motivo;
      venda.cancelada_por = ator.nome;
      venda.autorizada_por = autorizador ? autorizador.nome : ator.nome;
      venda.data_cancelamento = dataHora();
      return venda;
    });
  }

  editarVenda(id, body, ator) {
    return this.tx(() => {
      const venda = this.getVenda(id);
      if (!venda) throw erro('Venda não encontrada.', 404);
      if (venda.status_venda !== 'Concluída') throw erro('Somente vendas concluídas podem ser editadas.');
      const novos = Array.isArray(body.itens) ? body.itens : [];
      const quantidades = new Map();
      for (const it of novos) {
        const prod = this.getProductById(it.id_produto);
        if (!prod) throw erro('Produto não cadastrado.', 404);
        quantidades.set(prod.id_produto, r3((quantidades.get(prod.id_produto) || 0) + validarQuantidade(prod, it.quantidade)));
      }
      if (!quantidades.size) throw erro('A venda precisa ter ao menos um item. Para anulá-la, use o cancelamento.');
      const antigas = new Map();
      venda.itens.forEach(i => antigas.set(i.id_produto, r3((antigas.get(i.id_produto) || 0) + i.quantidade)));
      const ids = new Set([...antigas.keys(), ...quantidades.keys()]);
      for (const idp of ids) {
        const diff = r3((quantidades.get(idp) || 0) - (antigas.get(idp) || 0));
        const p = this.getProductById(idp);
        if (diff > 0 && p.quantidade_estoque < diff) throw erro(`Quantidade indisponível em estoque para "${p.nome_produto}"! Disponível para acréscimo: ${p.quantidade_estoque} ${p.unidade}.`);
      }
      const itensNovos = [];
      for (const [idp, q] of quantidades) {
        const p = this.getProductById(idp);
        const anterior = venda.itens.find(i => i.id_produto === idp);
        const preco = anterior ? anterior.valor_unitario : p.preco_venda;
        itensNovos.push({ id_item_venda: itensNovos.length + 1, id_produto: idp, nome_produto: p.nome_produto, unidade: p.unidade, quantidade: q, valor_unitario: preco, subtotal: r2(q * preco) });
      }
      for (const idp of ids) {
        const diff = r3((quantidades.get(idp) || 0) - (antigas.get(idp) || 0));
        if (diff === 0) continue;
        const p = this.getProductById(idp);
        p.quantidade_estoque = r3(p.quantidade_estoque - diff);
        this.addMovimentacao({
          tipo_movimentacao: diff > 0 ? 'Saída' : 'Entrada', quantidade: Math.abs(diff), origem: 'ajuste',
          observacao: `Ajuste por edição da ${venda.codigo_venda}`, id_produto: idp,
          valor_unitario: (itensNovos.find(i => i.id_produto === idp) || venda.itens.find(i => i.id_produto === idp)).valor_unitario
        }, ator);
      }
      const subtotal = r2(itensNovos.reduce((a, i) => a + i.subtotal, 0));
      const desc = this.resolverDesconto(subtotal, { desconto_tipo: venda.desconto_tipo, desconto: venda.desconto_tipo === 'percentual' ? venda.desconto_informado : Math.min(venda.desconto, subtotal) }, ator);
      venda.itens = itensNovos;
      venda.valor_subtotal = subtotal;
      venda.desconto = desc.valor;
      venda.valor_total = r2(subtotal - desc.valor);
      venda.editada_por = ator.nome;
      venda.data_edicao = dataHora();
      return venda;
    });
  }

  excluirVenda(id, ator) {
    return this.tx(() => {
      const venda = this.getVenda(id);
      if (!venda) throw erro('Venda não encontrada.', 404);
      if (venda.status_venda === 'Concluída') this.estornarItensVenda(venda, ator, 'Estorno de estoque por exclusão');
      this.vendas = this.vendas.filter(v => v.id_venda !== venda.id_venda);
      return venda;
    });
  }

  // ---------------------------------------------------------------- conferência de inventário (RF 06)
  salvarConferencia(body, ator) {
    return this.tx(() => {
      const itens = Array.isArray(body.itens) ? body.itens : [];
      if (!itens.length) throw erro('Nenhum item foi conferido.');
      const obs = validarTexto(body.observacao, 'A observação da conferência', { min: 10, max: 1000 });
      const ajustar = body.ajustar !== false;
      const id = this.proxId(this.conferencias, 'id_conferencia');
      const vistos = new Set();
      const proc = itens.map(item => {
        const prod = this.getProductById(item.id_produto);
        if (!prod) throw erro('Produto não cadastrado.', 404);
        if (vistos.has(prod.id_produto)) throw erro(`O produto "${prod.nome_produto}" foi informado mais de uma vez.`);
        vistos.add(prod.id_produto);
        const fisica = Number(item.quantidade_fisica);
        if (!Number.isFinite(fisica) || fisica < 0) throw erro(`Contagem inválida para "${prod.nome_produto}".`);
        if (!aceitaFracao(prod.unidade) && !Number.isInteger(fisica)) throw erro(`"${prod.nome_produto}" é contado em ${prod.unidade} e só aceita números inteiros.`);
        const sistema = prod.quantidade_estoque;
        const div = r3(fisica - sistema);
        if (ajustar && div !== 0) {
          prod.quantidade_estoque = r3(fisica);
          this.addMovimentacao({
            tipo_movimentacao: div > 0 ? 'Entrada' : 'Saída', quantidade: Math.abs(div), origem: 'conferencia',
            observacao: `Ajuste da conferência #${id} (sistema ${sistema} → físico ${r3(fisica)})`, id_produto: prod.id_produto
          }, ator);
        }
        return { id_produto: prod.id_produto, nome_produto: prod.nome_produto, unidade: prod.unidade, lote: prod.lote, quantidade_sistema: sistema, quantidade_fisica: r3(fisica), divergencia: div };
      });
      const conf = {
        id_conferencia: id, data_conferencia: dataHora(), responsavel: ator.nome, id_usuario: ator.id_usuario,
        observacao: obs, ajustou_estoque: ajustar, itens: proc
      };
      this.conferencias.unshift(conf);
      return conf;
    });
  }

  // ---------------------------------------------------------------- relatórios (RF 12, 13, 14)
  validarPeriodo({ from, to }) {
    if (from && !DATA_RE.test(from)) throw erro('A data inicial é inválida.');
    if (to && !DATA_RE.test(to)) throw erro('A data final é inválida.');
    if (from && to && from > to) throw erro('A data inicial não pode ser posterior à data final.');
  }

  getRelatorioVendas({ from, to, categoria } = {}) {
    this.validarPeriodo({ from, to });
    const cat = categoria ? Number(categoria) : null;
    const vendas = this.getVendas({ from, to, status: 'Concluída' });
    const mapa = new Map();
    const pagamentos = new Map();
    const transacoes = [];
    let bruto = 0, liquido = 0, descontos = 0;
    for (const v of vendas) {
      const razao = v.valor_subtotal > 0 ? v.valor_total / v.valor_subtotal : 1;
      let sub = 0;
      const resumo = [];
      for (const i of v.itens) {
        const p = this.getProductById(i.id_produto);
        if (cat && (!p || p.id_categoria !== cat)) continue;
        sub += i.subtotal;
        resumo.push(`${i.nome_produto} x${i.quantidade}`);
        const nomeCat = p ? this.categorias.find(c => c.id_categoria === p.id_categoria).nome_categoria : '-';
        const m = mapa.get(i.id_produto) || { id_produto: i.id_produto, nome_produto: i.nome_produto, categoria: nomeCat, unidade: i.unidade, quantidade: 0, total: 0 };
        m.quantidade = r3(m.quantidade + i.quantidade);
        m.total = r2(m.total + i.subtotal);
        mapa.set(i.id_produto, m);
      }
      if (!resumo.length) continue;
      const liq = r2(sub * razao);
      bruto = r2(bruto + sub); liquido = r2(liquido + liq); descontos = r2(descontos + (sub - liq));
      const pg = pagamentos.get(v.forma_pagamento) || { forma: v.forma_pagamento, total: 0, quantidade: 0 };
      pg.total = r2(pg.total + liq); pg.quantidade++;
      pagamentos.set(v.forma_pagamento, pg);
      transacoes.push({ id_venda: v.id_venda, codigo_venda: v.codigo_venda, data_venda: v.data_venda, usuario_nome: v.usuario_nome, forma_pagamento: v.forma_pagamento, itens_resumo: resumo.join(', '), bruto: r2(sub), desconto: r2(sub - liq), valor_total: liq });
    }
    const itensVendidos = [...mapa.values()].map(i => ({ ...i, valor_unitario: i.quantidade ? r2(i.total / i.quantidade) : 0 })).sort((a, b) => b.total - a.total);
    return {
      filtros: { from: from || null, to: to || null, categoria: cat },
      totalBruto: bruto, totalDescontos: descontos, totalGeral: liquido,
      quantidadeTransacoes: transacoes.length, ticketMedio: transacoes.length ? r2(liquido / transacoes.length) : 0,
      porPagamento: [...pagamentos.values()], itensVendidos, transacoes
    };
  }

  getRelatorioEstoque({ from, to, categoria } = {}) {
    this.validarPeriodo({ from, to });
    const cat = categoria ? Number(categoria) : null;
    const movs = this.getMovimentacoes({ from, to });
    const linhas = this.produtos.filter(p => p.status === 'Ativo' && (!cat || p.id_categoria === cat)).map(p => {
      const dele = movs.filter(m => m.id_produto === p.id_produto);
      const entradas = r3(dele.filter(m => m.tipo_movimentacao === 'Entrada').reduce((a, m) => a + m.quantidade, 0));
      const saidas = r3(dele.filter(m => m.tipo_movimentacao === 'Saída').reduce((a, m) => a + m.quantidade, 0));
      return {
        id_produto: p.id_produto, codigo_barras: p.codigo_barras, nome_produto: p.nome_produto, unidade: p.unidade,
        categoria: this.categorias.find(c => c.id_categoria === p.id_categoria).nome_categoria,
        entradas, saidas, saldo_atual: p.quantidade_estoque, estoque_minimo: p.estoque_minimo,
        valor_em_estoque: r2(p.quantidade_estoque * p.preco_custo),
        situacao: p.quantidade_estoque <= p.estoque_minimo ? 'Crítico' : 'Regular'
      };
    });
    return {
      filtros: { from: from || null, to: to || null, categoria: cat },
      totalProdutos: linhas.length, totalCriticos: linhas.filter(l => l.situacao === 'Crítico').length,
      valorTotalEstoque: r2(linhas.reduce((a, l) => a + l.valor_em_estoque, 0)), linhas
    };
  }

  // ---------------------------------------------------------------- busca global (barra de pesquisa)
  // `permitido(perm)` informa o que o perfil do usuário pode ver; nada além disso é retornado.
  buscaGlobal(q, permitido) {
    const t = normalize(txt(q));
    const out = { produtos: [], requisicoes: [], vendas: [], usuarios: [] };
    if (t.length < 2) return out;
    const lim = 5;
    const bate = (...campos) => campos.some(c => normalize(String(c === undefined || c === null ? '' : c)).includes(t));
    if (permitido('produtos:ver')) {
      out.produtos = this.produtos.filter(p => bate(p.nome_produto, p.codigo_barras, p.lote, p.descricao)).slice(0, lim).map(p => ({
        id_produto: p.id_produto, nome_produto: p.nome_produto, codigo_barras: p.codigo_barras, unidade: p.unidade,
        quantidade_estoque: p.quantidade_estoque, status: p.status,
        categoria: (this.categorias.find(c => c.id_categoria === p.id_categoria) || {}).nome_categoria || ''
      }));
    }
    if (permitido('requisicoes:ver')) {
      out.requisicoes = this.requisicoes.filter(r => bate(r.codigo_pedido, r.fornecedor, r.produto_nome, r.situacao)).slice(0, lim).map(r => ({
        id_requisicao: r.id_requisicao, codigo_pedido: r.codigo_pedido, produto_nome: r.produto_nome, fornecedor: r.fornecedor, situacao: r.situacao
      }));
    }
    if (permitido('vendas:ver')) {
      out.vendas = this.getVendas({}).filter(v => bate(v.codigo_venda, v.usuario_nome, v.forma_pagamento) || v.itens.some(i => bate(i.nome_produto))).slice(0, lim).map(v => ({
        id_venda: v.id_venda, codigo_venda: v.codigo_venda, data_venda: v.data_venda, valor_total: v.valor_total,
        usuario_nome: v.usuario_nome, status_venda: v.status_venda
      }));
    }
    if (permitido('usuarios:gerir')) {
      out.usuarios = this.usuarios.filter(u => bate(u.nome, u.email, u.cargo)).slice(0, lim).map(u => ({
        id_usuario: u.id_usuario, nome: u.nome, email: u.email, perfil: this.nomePerfil(u.id_perfil), status: u.status
      }));
    }
    return out;
  }

  registrarRelatorio(tipo, idUsuario) {
    this.relatorios.push({ id_relatorio: this.proxId(this.relatorios, 'id_relatorio'), tipo_relatorio: tipo, data_geracao: dataHora(), id_usuario: idUsuario });
    if (this.relatorios.length > 500) this.relatorios = this.relatorios.slice(-500);
    this.save();
  }
}

module.exports = new Database();
module.exports.Database = Database;
module.exports.util = { dataISO, dataHora, r2, r3, FORMAS_PAGAMENTO };
