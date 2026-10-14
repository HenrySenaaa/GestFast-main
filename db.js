// db.js - Camada de acesso ao banco MySQL do ERP GestFast
// Mantém os mesmos métodos e o mesmo formato de retorno do antigo banco em memória,
// para o frontend (public/) continuar funcionando sem alterações.
const { pool, transacao } = require('./database/conexao');

// Enquanto não há login (etapa de nov/2026), o usuário da operação continua fixo.
const USUARIO_OPERADOR = 2;  // Henry Sena
const USUARIO_GERENTE = 1;   // Francisco

const FMT_DATA_HORA = '%Y-%m-%d %H:%i';

function textoValido(texto, min = 10, max = 5000) {
  const t = (texto || '').trim();
  return t.length >= min && t.length <= max;
}

// Gera um código temporário único (até 20 caracteres) para colunas UNIQUE NOT NULL
// que só ganham o código definitivo depois que o INSERT devolve o id.
function codigoTemporario() {
  return `T${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

const SQL_REQUISICAO = `
  SELECT r.id_requisicao, r.codigo_pedido, f.nome AS fornecedor, r.produto_nome, r.id_produto,
         r.quantidade_pedida, r.quantidade_atendida, r.unidade, r.valor_unitario, r.valor_total,
         r.situacao, r.data_pedido, r.previsao_entrega, r.endereco_entrega, r.observacao,
         r.justificativa_cancelamento
    FROM requisicoes r
    JOIN fornecedores f ON f.id_fornecedor = r.id_fornecedor`;

const SQL_MOVIMENTACAO = `
  SELECT m.id_movimentacao, m.tipo_movimentacao, m.quantidade,
         DATE_FORMAT(m.data_movimentacao, '${FMT_DATA_HORA}') AS data_movimentacao,
         m.observacao, m.id_produto, p.nome_produto AS produto_nome, p.codigo_barras, p.unidade,
         m.valor_unitario, m.valor_total, m.id_usuario, u.nome AS usuario_nome
    FROM movimentacoes m
    JOIN produtos p ON p.id_produto = m.id_produto
    JOIN usuarios u ON u.id_usuario = m.id_usuario`;

class MySQLDatabase {
  // Categorias e Fornecedores
  async getCategorias() {
    const [rows] = await pool.query('SELECT id_categoria, nome_categoria, descricao FROM categorias ORDER BY id_categoria');
    return rows;
  }

  async getFornecedores() {
    const [rows] = await pool.query('SELECT nome FROM fornecedores ORDER BY id_fornecedor');
    return rows.map(r => r.nome);
  }

  // Métodos de Produtos (CRUD)
  async getProducts(query, categoriaId) {
    // A collation utf8mb4_0900_ai_ci já ignora acentos e maiúsculas no LIKE.
    let sql = "SELECT * FROM produtos WHERE status <> 'Inativo'";
    const params = [];
    if (categoriaId) {
      sql += ' AND id_categoria = ?';
      params.push(Number(categoriaId));
    }
    if (query) {
      const termo = `%${query}%`;
      sql += ' AND (nome_produto LIKE ? OR codigo_barras LIKE ? OR descricao LIKE ?)';
      params.push(termo, termo, termo);
    }
    sql += ' ORDER BY id_produto';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getProductById(id, conn = pool) {
    const [rows] = await conn.query('SELECT * FROM produtos WHERE id_produto = ?', [Number(id)]);
    return rows[0];
  }

  async saveProduct(data) {
    if (!data.nome_produto || !data.preco_venda) {
      throw new Error('Nome do produto e preço de venda são obrigatórios.');
    }
    const precoVenda = Number(data.preco_venda);
    if (precoVenda <= 0) {
      throw new Error('O preço de venda deve ser maior que zero.');
    }

    if (data.descricao && data.descricao.trim().length > 0) {
      if (!textoValido(data.descricao)) {
        throw new Error('A descrição do produto deve conter entre 10 e 5000 caracteres.');
      }
    }

    const valoresNumericos = {
      preco_custo: Number(data.preco_custo) || 0,
      preco_venda: precoVenda,
      preco_min: Number(data.preco_min) || precoVenda * 0.8,
      preco_max: Number(data.preco_max) || precoVenda * 1.3,
      quantidade_estoque: Number(data.quantidade_estoque) || 0,
      estoque_minimo: Number(data.estoque_minimo) || 10,
      id_categoria: Number(data.id_categoria) || 1
    };

    if (data.id_produto) {
      const atual = await this.getProductById(data.id_produto);
      if (!atual) throw new Error('Produto não encontrado.');
      const campo = nome => (data[nome] !== undefined ? data[nome] : atual[nome]);
      const prod = {
        codigo_barras: campo('codigo_barras'),
        nome_produto: data.nome_produto,
        descricao: campo('descricao'),
        unidade: campo('unidade'),
        peso: campo('peso'),
        status: campo('status'),
        lote: campo('lote'),
        validade: campo('validade') || null,
        imagem: campo('imagem'),
        ...valoresNumericos
      };
      await pool.query('UPDATE produtos SET ? WHERE id_produto = ?', [prod, atual.id_produto]);
      return this.getProductById(atual.id_produto);
    }

    return transacao(async conn => {
      const [result] = await conn.query('INSERT INTO produtos SET ?', [{
        codigo_barras: data.codigo_barras || codigoTemporario(),
        nome_produto: data.nome_produto,
        descricao: data.descricao || '',
        unidade: data.unidade || 'UN',
        peso: data.peso || '100g',
        status: 'Ativo',
        lote: data.lote || `L-${Math.floor(100000 + Math.random() * 900000)}`,
        validade: data.validade || '2026-12-31',
        imagem: data.imagem || 'assets/pao.png',
        ...valoresNumericos
      }]);
      const newId = result.insertId;
      if (!data.codigo_barras) {
        await conn.query('UPDATE produtos SET codigo_barras = ? WHERE id_produto = ?',
          [`789100${String(newId).padStart(2, '0')}`, newId]);
      }
      return this.getProductById(newId, conn);
    });
  }

  async deleteProduct(id) {
    const [result] = await pool.query("UPDATE produtos SET status = 'Inativo' WHERE id_produto = ?", [Number(id)]);
    if (result.affectedRows === 0) throw new Error('Produto não encontrado.');
    return true;
  }

  async getAlertasCriticos() {
    const [rows] = await pool.query(`
      SELECT id_produto, nome_produto, unidade, quantidade_estoque, estoque_minimo, lote, id_categoria
        FROM produtos
       WHERE status = 'Ativo' AND quantidade_estoque <= estoque_minimo
       ORDER BY id_produto`);
    return rows.map(p => ({
      id_produto: p.id_produto,
      nome_produto: p.nome_produto,
      unidade: p.unidade,
      quantidade_estoque: p.quantidade_estoque,
      estoque_minimo: p.estoque_minimo,
      lote: p.lote,
      categoria_id: p.id_categoria,
      mensagem: `${p.nome_produto} atingiu o estoque mínimo (${p.quantidade_estoque} ${p.unidade} disponíveis, mín: ${p.estoque_minimo})`
    }));
  }

  async getDashboardData() {
    const [[totais]] = await pool.query(`
      SELECT COUNT(*) AS totalProdutos, COALESCE(SUM(quantidade_estoque), 0) AS totalEmEstoque
        FROM produtos WHERE status = 'Ativo'`);
    const [[{ abertas }]] = await pool.query(
      "SELECT COUNT(*) AS abertas FROM requisicoes WHERE situacao = 'Em Aberto'");
    // Mesmo comportamento do banco em memória: soma todas as vendas concluídas.
    const [[{ totalVendas }]] = await pool.query(
      "SELECT COALESCE(SUM(valor_total), 0) AS totalVendas FROM vendas WHERE status_venda = 'Concluída'");
    const [porCategoria] = await pool.query(`
      SELECT c.nome_categoria AS categoria, SUM(p.quantidade_estoque) AS quantidade
        FROM categorias c
        JOIN produtos p ON p.id_categoria = c.id_categoria AND p.status = 'Ativo'
       GROUP BY c.id_categoria, c.nome_categoria
      HAVING quantidade > 0
       ORDER BY c.id_categoria`);
    const [[usuarioAtivo]] = await pool.query(
      'SELECT id_usuario, nome, email, cargo, status, data_criacao, id_perfil FROM usuarios WHERE id_usuario = ?',
      [USUARIO_GERENTE]);

    const totalEmEstoque = Number(totais.totalEmEstoque);
    const produtosEmAlerta = await this.getAlertasCriticos();
    const ultimasCompras = (await this.getRequisicoes()).slice(0, 6);

    return {
      usuarioAtivo,
      metricas: {
        totalProdutos: totais.totalProdutos,
        alertasCriticosCount: produtosEmAlerta.length,
        totalItensEstoque: totalEmEstoque,
        requisicoesAbertasCount: abertas,
        totalVendasHoje: Number(totalVendas).toFixed(2)
      },
      alertas: produtosEmAlerta,
      ultimasCompras,
      distribuicaoEstoque: porCategoria.map(item => ({
        categoria: item.categoria,
        quantidade: Number(item.quantidade),
        porcentagem: totalEmEstoque > 0 ? ((Number(item.quantidade) / totalEmEstoque) * 100).toFixed(1) : '0'
      }))
    };
  }

  // Requisições
  async getRequisicoes() {
    const [rows] = await pool.query(`${SQL_REQUISICAO} ORDER BY r.id_requisicao DESC`);
    return rows;
  }

  async getRequisicaoById(id, conn = pool) {
    const [rows] = await conn.query(`${SQL_REQUISICAO} WHERE r.id_requisicao = ?`, [Number(id)]);
    return rows[0];
  }

  async createRequisicao(data) {
    if (!data.fornecedor) throw new Error('Selecione um fornecedor da lista.');
    if (data.observacao && data.observacao.trim().length > 0) {
      if (!textoValido(data.observacao)) {
        throw new Error('A observação da requisição deve ter entre 10 e 5000 caracteres.');
      }
    }

    return transacao(async conn => {
      const [forn] = await conn.query('SELECT id_fornecedor FROM fornecedores WHERE nome = ?', [data.fornecedor]);
      if (!forn.length) throw new Error('Fornecedor não encontrado. Selecione um fornecedor da lista.');

      const [result] = await conn.query('INSERT INTO requisicoes SET ?', [{
        codigo_pedido: codigoTemporario(),
        id_fornecedor: forn[0].id_fornecedor,
        id_produto: data.id_produto ? Number(data.id_produto) : null,
        produto_nome: data.produto_nome,
        quantidade_pedida: Number(data.quantidade_pedida) || 1,
        unidade: data.unidade || 'UN',
        valor_unitario: Number(data.valor_unitario) || 0,
        previsao_entrega: data.previsao_entrega || null,
        endereco_entrega: data.endereco_entrega || 'Padrão - Padaria Nova York',
        observacao: data.observacao || ''
      }]);
      const newId = result.insertId;
      // Próximo número a partir do maior código existente (os códigos do histórico não seguem o id).
      const [[{ ultimo }]] = await conn.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(codigo_pedido, 5) AS UNSIGNED)), 9660) AS ultimo
          FROM requisicoes WHERE codigo_pedido LIKE 'REQ-%' FOR UPDATE`);
      await conn.query('UPDATE requisicoes SET codigo_pedido = ? WHERE id_requisicao = ?',
        [`REQ-${ultimo + 1}`, newId]);
      return this.getRequisicaoById(newId, conn);
    });
  }

  async updateRequisicaoStatus(id, situacao, justificativa = '') {
    return transacao(async conn => {
      const [rows] = await conn.query(
        'SELECT * FROM requisicoes WHERE id_requisicao = ? FOR UPDATE', [Number(id)]);
      const req = rows[0];
      if (!req) throw new Error('Requisição não encontrada.');
      // Evita dar entrada duas vezes no estoque pela mesma requisição.
      if (req.situacao !== 'Em Aberto') {
        throw new Error(`Esta requisição já está "${req.situacao}" e não pode mais ser alterada.`);
      }

      if (situacao === 'Cancelado') {
        if (!textoValido(justificativa)) {
          throw new Error('O motivo de cancelamento é obrigatório e deve ter entre 10 e 5000 caracteres.');
        }
        await conn.query(
          'UPDATE requisicoes SET situacao = ?, justificativa_cancelamento = ? WHERE id_requisicao = ?',
          [situacao, justificativa.trim(), req.id_requisicao]);
      } else {
        await conn.query('UPDATE requisicoes SET situacao = ? WHERE id_requisicao = ?', [situacao, req.id_requisicao]);
      }

      if (situacao === 'Finalizado' && req.id_produto) {
        const atualizada = await this.getRequisicaoById(req.id_requisicao, conn);
        await conn.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id_produto = ?',
          [req.quantidade_pedida, req.id_produto]);
        await this.addMovimentacao(conn, {
          tipo_movimentacao: 'Entrada',
          quantidade: req.quantidade_pedida,
          observacao: `Entrada automática por recebimento de requisição ${req.codigo_pedido} (${atualizada.fornecedor})`,
          id_produto: req.id_produto,
          valor_unitario: req.valor_unitario,
          id_usuario: USUARIO_GERENTE,
          id_requisicao: req.id_requisicao
        });
      }
      return this.getRequisicaoById(req.id_requisicao, conn);
    });
  }

  // Movimentações de Estoque
  async getMovimentacoes(tipo) {
    let sql = SQL_MOVIMENTACAO;
    const params = [];
    if (tipo) {
      sql += ' WHERE m.tipo_movimentacao = ?';
      params.push(tipo);
    }
    sql += ' ORDER BY m.id_movimentacao DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  // Grava uma linha de movimentação usando a conexão da transação em andamento.
  async addMovimentacao(conn, data) {
    const [result] = await conn.query('INSERT INTO movimentacoes SET ?', [{
      tipo_movimentacao: data.tipo_movimentacao,
      quantidade: Number(data.quantidade),
      observacao: data.observacao || '',
      id_produto: Number(data.id_produto),
      valor_unitario: Number(data.valor_unitario) || 0,
      id_usuario: data.id_usuario || USUARIO_GERENTE,
      id_venda: data.id_venda || null,
      id_requisicao: data.id_requisicao || null
    }]);
    const [rows] = await conn.query(`${SQL_MOVIMENTACAO} WHERE m.id_movimentacao = ?`, [result.insertId]);
    return rows[0];
  }

  async registrarMovimentacaoEstoque(data) {
    const qtd = Number(data.quantidade);
    if (!(qtd > 0)) throw new Error('A quantidade deve ser maior que zero.');

    if (data.observacao && data.observacao.trim().length > 0) {
      if (!textoValido(data.observacao)) {
        throw new Error('O motivo da movimentação deve ter entre 10 e 5000 caracteres.');
      }
    }

    return transacao(async conn => {
      const [rows] = await conn.query(
        'SELECT * FROM produtos WHERE id_produto = ? FOR UPDATE', [Number(data.id_produto)]);
      const prod = rows[0];
      if (!prod) throw new Error('Produto não encontrado.');

      if (data.tipo_movimentacao === 'Saída') {
        if (prod.quantidade_estoque < qtd) {
          throw new Error(`Estoque insuficiente! Saldo disponível: ${prod.quantidade_estoque} ${prod.unidade}.`);
        }
        await conn.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id_produto = ?',
          [qtd, prod.id_produto]);
      } else {
        await conn.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id_produto = ?',
          [qtd, prod.id_produto]);
      }

      return this.addMovimentacao(conn, {
        tipo_movimentacao: data.tipo_movimentacao,
        quantidade: qtd,
        observacao: data.observacao || `Movimentação manual registrada no sistema (${data.tipo_movimentacao})`,
        id_produto: prod.id_produto,
        valor_unitario: data.tipo_movimentacao === 'Saída' ? prod.preco_venda : prod.preco_custo,
        id_usuario: USUARIO_OPERADOR
      });
    });
  }

  // Vendas / Balcão (PDV)
  async getVendas(conn = pool, idVenda = null) {
    let sql = `
      SELECT v.id_venda, v.codigo_venda, DATE_FORMAT(v.data_venda, '${FMT_DATA_HORA}') AS data_venda,
             v.valor_total, v.desconto, v.forma_pagamento, v.status_venda, v.id_usuario,
             u.nome AS usuario_nome
        FROM vendas v
        JOIN usuarios u ON u.id_usuario = v.id_usuario`;
    const params = [];
    if (idVenda) {
      sql += ' WHERE v.id_venda = ?';
      params.push(Number(idVenda));
    }
    sql += ' ORDER BY v.id_venda DESC';
    const [vendas] = await conn.query(sql, params);
    if (!vendas.length) return [];

    const [itens] = await conn.query(`
      SELECT i.id_item_venda, i.id_venda, i.id_produto, p.nome_produto, i.quantidade, p.unidade,
             i.valor_unitario, i.subtotal
        FROM itens_venda i
        JOIN produtos p ON p.id_produto = i.id_produto
       WHERE i.id_venda IN (?)
       ORDER BY i.id_item_venda`, [vendas.map(v => v.id_venda)]);

    return vendas.map(v => ({
      ...v,
      itens: itens.filter(i => i.id_venda === v.id_venda).map(({ id_venda, ...item }) => item)
    }));
  }

  async realizarVenda(data) {
    if (!data.itens || !data.itens.length) {
      throw new Error('Nenhum item inserido na venda.');
    }

    return transacao(async conn => {
      // Trava os produtos da venda e confere o estoque de todos antes de gravar qualquer coisa.
      const produtos = {};
      for (const item of data.itens) {
        const [rows] = await conn.query(
          'SELECT * FROM produtos WHERE id_produto = ? FOR UPDATE', [Number(item.id_produto)]);
        const prod = rows[0];
        if (!prod) throw new Error(`Produto código #${item.id_produto} não localizado.`);
        if (prod.quantidade_estoque < Number(item.quantidade)) {
          throw new Error(`Quantidade indisponível em estoque para "${prod.nome_produto}"! Solicitado: ${item.quantidade}, Em estoque: ${prod.quantidade_estoque} ${prod.unidade}.`);
        }
        produtos[prod.id_produto] = prod;
      }

      const itens = data.itens.map(item => {
        const prod = produtos[Number(item.id_produto)];
        const qtd = Number(item.quantidade);
        const precoUnit = Number(item.valor_unitario) || prod.preco_venda;
        return { prod, qtd, precoUnit, subtotal: qtd * precoUnit };
      });

      const subtotalGeral = itens.reduce((acc, i) => acc + i.subtotal, 0);
      const desconto = Number(data.desconto) || 0;
      const totalFinal = Math.max(0, subtotalGeral - desconto);

      const [result] = await conn.query('INSERT INTO vendas SET ?', [{
        codigo_venda: codigoTemporario(),
        valor_total: totalFinal,
        desconto,
        forma_pagamento: data.forma_pagamento || 'Dinheiro',
        id_usuario: USUARIO_OPERADOR
      }]);
      const idVenda = result.insertId;
      await conn.query('UPDATE vendas SET codigo_venda = ? WHERE id_venda = ?', [`VENDA-${1000 + idVenda}`, idVenda]);

      for (const { prod, qtd, precoUnit } of itens) {
        await conn.query('INSERT INTO itens_venda (id_venda, id_produto, quantidade, valor_unitario) VALUES (?, ?, ?, ?)',
          [idVenda, prod.id_produto, qtd, precoUnit]);
        await conn.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id_produto = ?',
          [qtd, prod.id_produto]);
        await this.addMovimentacao(conn, {
          tipo_movimentacao: 'Saída',
          quantidade: qtd,
          observacao: 'Baixa automática de venda no balcão da padaria',
          id_produto: prod.id_produto,
          valor_unitario: precoUnit,
          id_usuario: USUARIO_OPERADOR,
          id_venda: idVenda
        });
      }

      const [venda] = await this.getVendas(conn, idVenda);
      return venda;
    });
  }

  async cancelarVenda(idVenda) {
    return transacao(async conn => {
      const [rows] = await conn.query('SELECT * FROM vendas WHERE id_venda = ? FOR UPDATE', [Number(idVenda)]);
      const venda = rows[0];
      if (!venda) throw new Error('Venda não encontrada.');
      if (venda.status_venda === 'Cancelada') throw new Error('Esta venda já está cancelada.');

      const [itens] = await conn.query('SELECT * FROM itens_venda WHERE id_venda = ?', [venda.id_venda]);
      for (const item of itens) {
        await conn.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + ? WHERE id_produto = ?',
          [item.quantidade, item.id_produto]);
        await this.addMovimentacao(conn, {
          tipo_movimentacao: 'Entrada',
          quantidade: item.quantidade,
          observacao: `Estorno de estoque por cancelamento da venda ${venda.codigo_venda}`,
          id_produto: item.id_produto,
          valor_unitario: item.valor_unitario,
          id_usuario: USUARIO_GERENTE,
          id_venda: venda.id_venda
        });
      }

      await conn.query("UPDATE vendas SET status_venda = 'Cancelada' WHERE id_venda = ?", [venda.id_venda]);
      const [cancelada] = await this.getVendas(conn, venda.id_venda);
      return cancelada;
    });
  }

  // Conferência de Inventário Físico
  async getConferencias(conn = pool, idConferencia = null) {
    let sql = `
      SELECT c.id_conferencia, DATE_FORMAT(c.data_conferencia, '${FMT_DATA_HORA}') AS data_conferencia,
             u.nome AS responsavel, c.observacao
        FROM conferencias c
        JOIN usuarios u ON u.id_usuario = c.id_usuario`;
    const params = [];
    if (idConferencia) {
      sql += ' WHERE c.id_conferencia = ?';
      params.push(Number(idConferencia));
    }
    sql += ' ORDER BY c.id_conferencia DESC';
    const [conferencias] = await conn.query(sql, params);
    if (!conferencias.length) return [];

    const [itens] = await conn.query(`
      SELECT i.id_conferencia, i.id_produto, p.nome_produto, p.unidade, i.lote,
             i.quantidade_sistema, i.quantidade_fisica, i.divergencia
        FROM itens_conferencia i
        JOIN produtos p ON p.id_produto = i.id_produto
       WHERE i.id_conferencia IN (?)
       ORDER BY i.id_item_conferencia`, [conferencias.map(c => c.id_conferencia)]);

    return conferencias.map(c => ({
      ...c,
      itens: itens.filter(i => i.id_conferencia === c.id_conferencia).map(({ id_conferencia, ...item }) => item)
    }));
  }

  async salvarConferencia(responsavel, itensConferidos, observacao = '') {
    if (!itensConferidos || !itensConferidos.length) {
      throw new Error('Nenhum item informado na conferência.');
    }

    return transacao(async conn => {
      const [usuarios] = await conn.query('SELECT id_usuario FROM usuarios WHERE nome = ?', [responsavel || '']);
      const idUsuario = usuarios.length ? usuarios[0].id_usuario : USUARIO_OPERADOR;

      const [result] = await conn.query(
        'INSERT INTO conferencias (id_usuario, observacao) VALUES (?, ?)', [idUsuario, observacao || '']);
      const idConferencia = result.insertId;

      for (const item of itensConferidos) {
        const [rows] = await conn.query(
          'SELECT * FROM produtos WHERE id_produto = ? FOR UPDATE', [Number(item.id_produto)]);
        const prod = rows[0];
        if (!prod) throw new Error(`Produto código #${item.id_produto} não localizado.`);
        const qtdFisica = Number(item.quantidade_fisica);

        await conn.query(`
          INSERT INTO itens_conferencia
            (id_conferencia, id_produto, lote, quantidade_sistema, quantidade_fisica, estoque_ajustado)
          VALUES (?, ?, ?, ?, ?, ?)`,
          [idConferencia, prod.id_produto, prod.lote, prod.quantidade_estoque, qtdFisica, !!item.ajustarEstoque]);

        if (item.ajustarEstoque) {
          await conn.query('UPDATE produtos SET quantidade_estoque = ? WHERE id_produto = ?', [qtdFisica, prod.id_produto]);
        }
      }

      const [conferencia] = await this.getConferencias(conn, idConferencia);
      return conferencia;
    });
  }

  // Relatórios
  async getRelatorioVendas() {
    const [ranking] = await pool.query(`
      SELECT i.id_produto, p.nome_produto, SUM(i.quantidade) AS quantidade,
             MIN(i.valor_unitario) AS valor_unitario, SUM(i.subtotal) AS total
        FROM itens_venda i
        JOIN vendas v ON v.id_venda = i.id_venda AND v.status_venda = 'Concluída'
        JOIN produtos p ON p.id_produto = i.id_produto
       GROUP BY i.id_produto, p.nome_produto
       ORDER BY total DESC`);
    const [[resumo]] = await pool.query(`
      SELECT COALESCE(SUM(valor_total), 0) AS totalGeral, COUNT(*) AS quantidadeTransacoes
        FROM vendas WHERE status_venda = 'Concluída'`);

    return {
      totalGeral: Number(resumo.totalGeral),
      itensVendidos: ranking.map(r => ({ ...r, quantidade: Number(r.quantidade), total: Number(r.total) })),
      quantidadeTransacoes: resumo.quantidadeTransacoes,
      historicoVendas: await this.getVendas()
    };
  }
}

module.exports = new MySQLDatabase();
