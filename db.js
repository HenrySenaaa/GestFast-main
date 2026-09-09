// db.js - Banco de Dados Simulado em Memória para o ERP GestFast
function normalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

class MockDatabase {
  constructor() {
    this.init();
  }

  init() {
    this.perfis = [
      { id_perfil: 1, nome_perfil: 'Administrador' },
      { id_perfil: 2, nome_perfil: 'BackOffice' },
      { id_perfil: 3, nome_perfil: 'Funcionario' }
    ];

    this.usuarios = [
      {
        id_usuario: 1,
        nome: 'Francisco',
        email: 'proprietario@padarianovayork.com',
        cargo: 'Proprietário',
        status: 'Ativo',
        data_criacao: '2026-01-10',
        id_perfil: 1
      },
      {
        id_usuario: 2,
        nome: 'Henry Sena',
        email: 'henry@padarianovayork.com',
        cargo: 'Atendente / Operador de Caixa',
        status: 'Ativo',
        data_criacao: '2026-02-01',
        id_perfil: 3
      }
    ];

    this.categorias = [
      { id_categoria: 1, nome_categoria: 'Pães', descricao: 'Pães artesanais, franceses, baguetes e doces' },
      { id_categoria: 2, nome_categoria: 'Bebidas & Cafés', descricao: 'Cafés, sucos, refrigerantes e laticínios' },
      { id_categoria: 3, nome_categoria: 'Mercearia & Insumos', descricao: 'Farinhas, açúcares, fermentos e ingredientes' },
      { id_categoria: 4, nome_categoria: 'Confeitaria & Bolos', descricao: 'Bolos, doces, tortas e sobremesas' },
      { id_categoria: 5, nome_categoria: 'Frios & Derivados', descricao: 'Queijos, presuntos, manteigas e frios fatiados' }
    ];

    this.produtos = [
      {
        id_produto: 1,
        codigo_barras: '78910001',
        nome_produto: 'Pão de Queijo',
        descricao: 'Pão de queijo tradicional de Minas 50g',
        unidade: 'UN',
        peso: '50g',
        preco_custo: 1.20,
        preco_venda: 3.50,
        preco_min: 2.50,
        preco_max: 5.00,
        quantidade_estoque: 10,
        estoque_minimo: 30,
        status: 'Ativo',
        id_categoria: 1,
        lote: '546320',
        validade: '2026-09-15'
      },
      {
        id_produto: 2,
        codigo_barras: '78910002',
        nome_produto: 'Café Pilão 320g',
        descricao: 'Café torrado e moído tradicional 320g',
        unidade: 'Pacote',
        peso: '320g',
        preco_custo: 12.50,
        preco_venda: 18.90,
        preco_min: 15.00,
        preco_max: 22.00,
        quantidade_estoque: 20,
        estoque_minimo: 25,
        status: 'Ativo',
        id_categoria: 2,
        lote: '548417',
        validade: '2026-12-20'
      },
      {
        id_produto: 3,
        codigo_barras: '78910003',
        nome_produto: 'Bolo de Cenoura',
        descricao: 'Bolo caseiro de cenoura com calda generosa de chocolate',
        unidade: 'Fatia',
        peso: '120g',
        preco_custo: 4.50,
        preco_venda: 12.00,
        preco_min: 9.00,
        preco_max: 16.00,
        quantidade_estoque: 4,
        estoque_minimo: 12,
        status: 'Ativo',
        id_categoria: 4,
        lote: '546328',
        validade: '2026-09-12'
      },
      {
        id_produto: 4,
        codigo_barras: '78910004',
        nome_produto: 'Pão Francês',
        descricao: 'Pão francês artesanal assado de hora em hora',
        unidade: 'KG',
        peso: '1000g',
        preco_custo: 5.50,
        preco_venda: 16.90,
        preco_min: 14.00,
        preco_max: 19.90,
        quantidade_estoque: 70,
        estoque_minimo: 30,
        status: 'Ativo',
        id_categoria: 1,
        lote: '545846',
        validade: '2026-09-10'
      },
      {
        id_produto: 5,
        codigo_barras: '78910005',
        nome_produto: 'Açúcar Cristal 1kg',
        descricao: 'Açúcar cristal refinado 1kg',
        unidade: 'Pacote',
        peso: '1000g',
        preco_custo: 3.20,
        preco_venda: 5.50,
        preco_min: 4.00,
        preco_max: 7.00,
        quantidade_estoque: 12,
        estoque_minimo: 20,
        status: 'Ativo',
        id_categoria: 3,
        lote: '546326',
        validade: '2027-01-20'
      },
      {
        id_produto: 6,
        codigo_barras: '78910006',
        nome_produto: 'Farinha de Trigo Especial 1kg',
        descricao: 'Farinha de trigo tipo 1 para panificação profissional',
        unidade: 'Pacote',
        peso: '1000g',
        preco_custo: 4.10,
        preco_venda: 6.80,
        preco_min: 5.00,
        preco_max: 8.50,
        quantidade_estoque: 18,
        estoque_minimo: 40,
        status: 'Ativo',
        id_categoria: 3,
        lote: '547890',
        validade: '2026-11-30'
      },
      {
        id_produto: 7,
        codigo_barras: '78910007',
        nome_produto: 'Queijo Mussarela Fatiado',
        descricao: 'Queijo mussarela fatiado fresco para lanches',
        unidade: 'KG',
        peso: '1000g',
        preco_custo: 32.00,
        preco_venda: 48.00,
        preco_min: 40.00,
        preco_max: 56.00,
        quantidade_estoque: 6,
        estoque_minimo: 15,
        status: 'Ativo',
        id_categoria: 5,
        lote: '549012',
        validade: '2026-09-20'
      },
      {
        id_produto: 8,
        codigo_barras: '78910008',
        nome_produto: 'Leite Integral 1L',
        descricao: 'Leite UHT integral pasteurizado 1L',
        unidade: 'UN',
        peso: '1000ml',
        preco_custo: 3.80,
        preco_venda: 6.00,
        preco_min: 4.90,
        preco_max: 7.50,
        quantidade_estoque: 80,
        estoque_minimo: 30,
        status: 'Ativo',
        id_categoria: 2,
        lote: '548900',
        validade: '2026-10-15'
      },
      {
        id_produto: 9,
        codigo_barras: '78910009',
        nome_produto: 'Ovos Brancos Granjeiros (Dúzia)',
        descricao: 'Dúzia de ovos brancos selecionados tipo grande',
        unidade: 'DZ',
        peso: '650g',
        preco_custo: 8.50,
        preco_venda: 15.00,
        preco_min: 12.00,
        preco_max: 18.00,
        quantidade_estoque: 100,
        estoque_minimo: 35,
        status: 'Ativo',
        id_categoria: 3,
        lote: '549111',
        validade: '2026-09-25'
      },
      {
        id_produto: 10,
        codigo_barras: '78910010',
        nome_produto: 'Suco de Uva Integral 500ml',
        descricao: 'Suco de uva tinto 100% natural sem adição de açúcares',
        unidade: 'UN',
        peso: '500ml',
        preco_custo: 4.80,
        preco_venda: 8.00,
        preco_min: 6.50,
        preco_max: 10.00,
        quantidade_estoque: 25,
        estoque_minimo: 15,
        status: 'Ativo',
        id_categoria: 2,
        lote: '578412',
        validade: '2026-12-30'
      },
      {
        id_produto: 11,
        codigo_barras: '78910011',
        nome_produto: 'Pão Doce Tradicional',
        descricao: 'Pão doce fofinho com creme de baunilha e coco',
        unidade: 'UN',
        peso: '80g',
        preco_custo: 1.10,
        preco_venda: 3.20,
        preco_min: 2.50,
        preco_max: 4.00,
        quantidade_estoque: 60,
        estoque_minimo: 20,
        status: 'Ativo',
        id_categoria: 1,
        lote: '548999',
        validade: '2026-09-11'
      },
      {
        id_produto: 12,
        codigo_barras: '78910012',
        nome_produto: 'Bala Toffee Mastigável',
        descricao: 'Balas caramelizadas artesanais sortidas',
        unidade: 'UN',
        peso: '10g',
        preco_custo: 0.10,
        preco_venda: 0.30,
        preco_min: 0.20,
        preco_max: 0.50,
        quantidade_estoque: 200,
        estoque_minimo: 50,
        status: 'Ativo',
        id_categoria: 4,
        lote: '546111',
        validade: '2027-04-10'
      }
    ];

    this.requisicoes = [
      {
        id_requisicao: 1,
        codigo_pedido: 'REQ-9666',
        fornecedor: 'Empresa Pão e Açúcar Dist.',
        produto_nome: 'Café Pilão 320g',
        id_produto: 2,
        quantidade_pedida: 50,
        quantidade_atendida: 15,
        unidade: 'Pacote',
        valor_unitario: 12.50,
        valor_total: 625.00,
        situacao: 'Em Aberto',
        data_pedido: '2026-09-06',
        previsao_entrega: '2026-09-12',
        endereco_entrega: 'Padaria Nova York - Rua Visconde de Inhaúma, 450',
        observacao: 'Pedido prioritário devido ao alto consumo matinal.'
      },
      {
        id_requisicao: 2,
        codigo_pedido: 'REQ-9667',
        fornecedor: 'Granja Santo André Ltda',
        produto_nome: 'Ovos Brancos Granjeiros (Dúzia)',
        id_produto: 9,
        quantidade_pedida: 100,
        quantidade_atendida: 0,
        unidade: 'DZ',
        valor_unitario: 8.50,
        valor_total: 850.00,
        situacao: 'Em Aberto',
        data_pedido: '2026-09-07',
        previsao_entrega: '2026-09-11',
        endereco_entrega: 'Padrão',
        observacao: 'Reposição para produção de massas e confeitaria.'
      },
      {
        id_requisicao: 3,
        codigo_pedido: 'REQ-9668',
        fornecedor: 'Moinho Paulista de Trigo',
        produto_nome: 'Farinha de Trigo Especial 1kg',
        id_produto: 6,
        quantidade_pedida: 50,
        quantidade_atendida: 0,
        unidade: 'Pacote',
        valor_unitario: 4.10,
        valor_total: 205.00,
        situacao: 'Em Aberto',
        data_pedido: '2026-09-07',
        previsao_entrega: '2026-09-13',
        endereco_entrega: 'Padrão',
        observacao: 'Farinha com teor protéico ideal para baguetes.'
      },
      {
        id_requisicao: 4,
        codigo_pedido: 'REQ-9669',
        fornecedor: 'Confeitaria Doce Arte',
        produto_nome: 'Bolo de Cenoura',
        id_produto: 3,
        quantidade_pedida: 30,
        quantidade_atendida: 0,
        unidade: 'Fatia',
        valor_unitario: 4.50,
        valor_total: 135.00,
        situacao: 'Em Aberto',
        data_pedido: '2026-09-08',
        previsao_entrega: '2026-09-10',
        endereco_entrega: 'Padrão',
        observacao: 'Estoque atual em 4 unidades.'
      },
      {
        id_requisicao: 5,
        codigo_pedido: 'REQ-9670',
        fornecedor: 'Panificadora Central e Distribuição',
        produto_nome: 'Pão Francês',
        id_produto: 4,
        quantidade_pedida: 60,
        quantidade_atendida: 60,
        unidade: 'KG',
        valor_unitario: 5.50,
        valor_total: 330.00,
        situacao: 'Finalizado',
        data_pedido: '2026-09-04',
        previsao_entrega: '2026-09-05',
        endereco_entrega: 'Padrão',
        observacao: 'Entregue com pontualidade e conferido.'
      }
    ];

    this.movimentacoes = [
      {
        id_movimentacao: 1,
        tipo_movimentacao: 'Entrada',
        quantidade: 60,
        data_movimentacao: '2026-09-05 07:30',
        observacao: 'Recebimento de lote do fornecedor Panificadora Central',
        id_produto: 4,
        produto_nome: 'Pão Francês',
        codigo_barras: '78910004',
        unidade: 'KG',
        valor_unitario: 5.50,
        valor_total: 330.00,
        id_usuario: 1,
        usuario_nome: 'Francisco'
      },
      {
        id_movimentacao: 2,
        tipo_movimentacao: 'Saída',
        quantidade: 15,
        data_movimentacao: '2026-09-07 18:20',
        observacao: 'Vendas acumuladas do balcão de frios e lanches',
        id_produto: 1,
        produto_nome: 'Pão de Queijo',
        codigo_barras: '78910001',
        unidade: 'UN',
        valor_unitario: 3.50,
        valor_total: 52.50,
        id_usuario: 2,
        usuario_nome: 'Henry Sena'
      },
      {
        id_movimentacao: 3,
        tipo_movimentacao: 'Saída',
        quantidade: 6,
        data_movimentacao: '2026-09-08 14:10',
        observacao: 'Venda de Café Pilão para clientes do salão',
        id_produto: 2,
        produto_nome: 'Café Pilão 320g',
        codigo_barras: '78910002',
        unidade: 'Pacote',
        valor_unitario: 18.90,
        valor_total: 113.40,
        id_usuario: 2,
        usuario_nome: 'Henry Sena'
      }
    ];

    this.vendas = [
      {
        id_venda: 1,
        codigo_venda: 'VENDA-1001',
        data_venda: '2026-09-08 10:15',
        valor_total: 90.00,
        desconto: 0.00,
        forma_pagamento: 'Cartão Débito',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 1, id_produto: 2, nome_produto: 'Café Pilão 320g', quantidade: 5, valor_unitario: 18.00, subtotal: 90.00 }
        ]
      },
      {
        id_venda: 2,
        codigo_venda: 'VENDA-1002',
        data_venda: '2026-09-08 11:40',
        valor_total: 118.40,
        desconto: 0.00,
        forma_pagamento: 'Dinheiro',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 2, id_produto: 11, nome_produto: 'Pão Doce Tradicional', quantidade: 37, valor_unitario: 3.20, subtotal: 118.40 }
        ]
      },
      {
        id_venda: 3,
        codigo_venda: 'VENDA-1003',
        data_venda: '2026-09-08 13:10',
        valor_total: 120.00,
        desconto: 0.00,
        forma_pagamento: 'PIX',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 3, id_produto: 8, nome_produto: 'Leite Integral 1L', quantidade: 20, valor_unitario: 6.00, subtotal: 120.00 }
        ]
      },
      {
        id_venda: 4,
        codigo_venda: 'VENDA-1004',
        data_venda: '2026-09-08 14:35',
        valor_total: 450.00,
        desconto: 0.00,
        forma_pagamento: 'Cartão Crédito',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 4, id_produto: 9, nome_produto: 'Ovos Brancos Granjeiros (Dúzia)', quantidade: 30, valor_unitario: 15.00, subtotal: 450.00 }
        ]
      },
      {
        id_venda: 5,
        codigo_venda: 'VENDA-1005',
        data_venda: '2026-09-08 15:50',
        valor_total: 110.00,
        desconto: 0.00,
        forma_pagamento: 'Dinheiro',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 5, id_produto: 4, nome_produto: 'Pão Francês', quantidade: 6.5, valor_unitario: 16.90, subtotal: 110.00 }
        ]
      },
      {
        id_venda: 6,
        codigo_venda: 'VENDA-1006',
        data_venda: '2026-09-08 17:05',
        valor_total: 96.00,
        desconto: 0.00,
        forma_pagamento: 'PIX',
        status_venda: 'Concluída',
        id_usuario: 2,
        usuario_nome: 'Henry Sena',
        itens: [
          { id_item_venda: 6, id_produto: 10, nome_produto: 'Suco de Uva Integral 500ml', quantidade: 12, valor_unitario: 8.00, subtotal: 96.00 }
        ]
      }
    ];

    this.conferencias = [
      {
        id_conferencia: 1,
        data_conferencia: '2026-09-01 14:00',
        responsavel: 'Henry Sena',
        observacao: 'Conferência quinzenal de estoque físico de farinhas e laticínios.',
        itens: [
          { id_produto: 5, nome_produto: 'Açúcar Cristal 1kg', unidade: 'Pacote', lote: '546326', quantidade_sistema: 12, quantidade_fisica: 12, divergencia: 0 },
          { id_produto: 2, nome_produto: 'Café Pilão 320g', unidade: 'Pacote', lote: '548417', quantidade_sistema: 25, quantidade_fisica: 25, divergencia: 0 },
          { id_produto: 4, nome_produto: 'Pão Francês', unidade: 'KG', lote: '545846', quantidade_sistema: 70, quantidade_fisica: 68, divergencia: -2 },
          { id_produto: 10, nome_produto: 'Suco de Uva Integral 500ml', unidade: 'UN', lote: '578412', quantidade_sistema: 25, quantidade_fisica: 25, divergencia: 0 }
        ]
      }
    ];
  }

  // Métodos de Produtos
  getProducts(query, categoriaId) {
    let list = this.produtos.filter(p => p.status !== 'Inativo');
    if (categoriaId) {
      list = list.filter(p => p.id_categoria === Number(categoriaId));
    }
    if (query) {
      const term = normalize(query);
      list = list.filter(p =>
        normalize(p.nome_produto).includes(term) ||
        normalize(p.codigo_barras).includes(term) ||
        normalize(p.descricao).includes(term)
      );
    }
    return list;
  }

  getProductById(id) {
    return this.produtos.find(p => p.id_produto === Number(id));
  }

  saveProduct(data) {
    if (!data.nome_produto || !data.preco_venda) {
      throw new Error('Nome do produto e preço de venda são obrigatórios.');
    }
    const precoVenda = Number(data.preco_venda);
    if (precoVenda <= 0) {
      throw new Error('O preço de venda deve ser maior que zero.');
    }

    if (data.id_produto) {
      const idx = this.produtos.findIndex(p => p.id_produto === Number(data.id_produto));
      if (idx === -1) throw new Error('Produto não encontrado.');
      this.produtos[idx] = {
        ...this.produtos[idx],
        ...data,
        id_produto: Number(data.id_produto),
        preco_custo: Number(data.preco_custo) || 0,
        preco_venda: precoVenda,
        preco_min: Number(data.preco_min) || precoVenda * 0.8,
        preco_max: Number(data.preco_max) || precoVenda * 1.3,
        quantidade_estoque: Number(data.quantidade_estoque) || 0,
        estoque_minimo: Number(data.estoque_minimo) || 10,
        id_categoria: Number(data.id_categoria) || 1
      };
      return this.produtos[idx];
    } else {
      const newId = this.produtos.length ? Math.max(...this.produtos.map(p => p.id_produto)) + 1 : 1;
      const cod = data.codigo_barras || `789100${String(newId).padStart(2, '0')}`;
      const newProd = {
        id_produto: newId,
        codigo_barras: cod,
        nome_produto: data.nome_produto,
        descricao: data.descricao || '',
        unidade: data.unidade || 'UN',
        peso: data.peso || '100g',
        preco_custo: Number(data.preco_custo) || 0,
        preco_venda: precoVenda,
        preco_min: Number(data.preco_min) || precoVenda * 0.8,
        preco_max: Number(data.preco_max) || precoVenda * 1.3,
        quantidade_estoque: Number(data.quantidade_estoque) || 0,
        estoque_minimo: Number(data.estoque_minimo) || 10,
        status: 'Ativo',
        id_categoria: Number(data.id_categoria) || 1,
        lote: data.lote || `L-${Math.floor(100000 + Math.random() * 900000)}`,
        validade: data.validade || '2026-12-31'
      };
      this.produtos.push(newProd);
      return newProd;
    }
  }

  deleteProduct(id) {
    const idx = this.produtos.findIndex(p => p.id_produto === Number(id));
    if (idx === -1) throw new Error('Produto não encontrado.');
    this.produtos[idx].status = 'Inativo';
    return true;
  }

  // Alertas Críticos (RF 11)
  getAlertasCriticos() {
    return this.produtos
      .filter(p => p.status === 'Ativo' && Number(p.quantidade_estoque) <= Number(p.estoque_minimo))
      .map(p => ({
        id_produto: p.id_produto,
        nome_produto: p.nome_produto,
        unidade: p.unidade,
        quantidade_estoque: p.quantidade_estoque,
        estoque_minimo: p.estoque_minimo,
        lote: p.lote,
        categoria_id: p.id_categoria,
        mensagem: `Atenção: ${p.nome_produto} atingiu o estoque mínimo (${p.quantidade_estoque} ${p.unidade} disponíveis, mín: ${p.estoque_minimo})`
      }));
  }

  // Dashboard Aggregates (RF 10)
  getDashboardData() {
    const totalProdutos = this.produtos.filter(p => p.status === 'Ativo').length;
    const produtosEmAlerta = this.getAlertasCriticos();
    const totalEmEstoque = this.produtos
      .filter(p => p.status === 'Ativo')
      .reduce((acc, p) => acc + Number(p.quantidade_estoque), 0);
    const requisicoesAbertas = this.requisicoes.filter(r => r.situacao === 'Em Aberto');
    const totalVendasHoje = this.vendas
      .filter(v => v.status_venda === 'Concluída')
      .reduce((acc, v) => acc + Number(v.valor_total), 0);

    const categoriasMap = {};
    this.categorias.forEach(c => {
      categoriasMap[c.id_categoria] = { nome: c.nome_categoria, total: 0 };
    });
    this.produtos.forEach(p => {
      if (p.status === 'Ativo' && categoriasMap[p.id_categoria]) {
        categoriasMap[p.id_categoria].total += Number(p.quantidade_estoque);
      }
    });

    const distribuicaoEstoque = Object.values(categoriasMap)
      .filter(item => item.total > 0)
      .map(item => ({
        categoria: item.nome,
        quantidade: item.total,
        porcentagem: totalEmEstoque > 0 ? ((item.total / totalEmEstoque) * 100).toFixed(1) : '0'
      }));

    return {
      usuarioAtivo: this.usuarios[0],
      metricas: {
        totalProdutos,
        alertasCriticosCount: produtosEmAlerta.length,
        totalItensEstoque: totalEmEstoque,
        requisicoesAbertasCount: requisicoesAbertas.length,
        totalVendasHoje: totalVendasHoje.toFixed(2)
      },
      alertas: produtosEmAlerta,
      ultimasCompras: this.requisicoes.slice(0, 6),
      distribuicaoEstoque
    };
  }

  // Requisições (RF 05)
  createRequisicao(data) {
    const newId = this.requisicoes.length ? Math.max(...this.requisicoes.map(r => r.id_requisicao)) + 1 : 1;
    const req = {
      id_requisicao: newId,
      codigo_pedido: `REQ-${9660 + newId}`,
      fornecedor: data.fornecedor || 'Fornecedor Padrão',
      produto_nome: data.produto_nome,
      id_produto: data.id_produto ? Number(data.id_produto) : null,
      quantidade_pedida: Number(data.quantidade_pedida) || 1,
      quantidade_atendida: 0,
      unidade: data.unidade || 'UN',
      valor_unitario: Number(data.valor_unitario) || 0,
      valor_total: (Number(data.quantidade_pedida) || 1) * (Number(data.valor_unitario) || 0),
      situacao: 'Em Aberto',
      data_pedido: new Date().toISOString().slice(0, 10),
      previsao_entrega: data.previsao_entrega || '2026-09-15',
      endereco_entrega: data.endereco_entrega || 'Padrão - Padaria Nova York',
      observacao: data.observacao || ''
    };
    this.requisicoes.unshift(req);
    return req;
  }

  updateRequisicaoStatus(id, situacao, justificativa = '') {
    const req = this.requisicoes.find(r => r.id_requisicao === Number(id));
    if (!req) throw new Error('Requisição não encontrada.');
    req.situacao = situacao;
    if (justificativa) req.justificativa_cancelamento = justificativa;

    // Se a requisição for marcada como Finalizada, dá entrada no estoque automaticamente
    if (situacao === 'Finalizado' && req.id_produto) {
      const prod = this.getProductById(req.id_produto);
      if (prod) {
        prod.quantidade_estoque += Number(req.quantidade_pedida);
        this.addMovimentacao({
          tipo_movimentacao: 'Entrada',
          quantidade: req.quantidade_pedida,
          observacao: `Entrada automática por recebimento de requisição ${req.codigo_pedido} (${req.fornecedor})`,
          id_produto: prod.id_produto,
          produto_nome: prod.nome_produto,
          codigo_barras: prod.codigo_barras,
          unidade: prod.unidade,
          valor_unitario: req.valor_unitario,
          valor_total: req.valor_total,
          id_usuario: 1,
          usuario_nome: 'Francisco'
        });
      }
    }
    return req;
  }

  // Movimentações de Estoque (RF 04)
  addMovimentacao(data) {
    const newId = this.movimentacoes.length ? Math.max(...this.movimentacoes.map(m => m.id_movimentacao)) + 1 : 1;
    const now = new Date();
    const dataFormatada = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const mov = {
      id_movimentacao: newId,
      tipo_movimentacao: data.tipo_movimentacao, // 'Entrada' ou 'Saída'
      quantidade: Number(data.quantidade),
      data_movimentacao: dataFormatada,
      observacao: data.observacao || '',
      id_produto: Number(data.id_produto),
      produto_nome: data.produto_nome,
      codigo_barras: data.codigo_barras || '',
      unidade: data.unidade || 'UN',
      valor_unitario: Number(data.valor_unitario) || 0,
      valor_total: (Number(data.quantidade) || 0) * (Number(data.valor_unitario) || 0),
      id_usuario: data.id_usuario || 1,
      usuario_nome: data.usuario_nome || 'Francisco'
    };
    this.movimentacoes.unshift(mov);
    return mov;
  }

  // Registrar Movimentação Manual e atualizar saldo do produto
  registrarMovimentacaoEstoque(data) {
    const prod = this.getProductById(data.id_produto);
    if (!prod) throw new Error('Produto não encontrado.');

    const qtd = Number(data.quantidade);
    if (qtd <= 0) throw new Error('A quantidade deve ser maior que zero.');

    if (data.tipo_movimentacao === 'Saída') {
      if (prod.quantidade_estoque < qtd) {
        throw new Error(`Estoque insuficiente! Saldo disponível: ${prod.quantidade_estoque} ${prod.unidade}.`);
      }
      prod.quantidade_estoque -= qtd;
    } else {
      prod.quantidade_estoque += qtd;
    }

    return this.addMovimentacao({
      tipo_movimentacao: data.tipo_movimentacao,
      quantidade: qtd,
      observacao: data.observacao || `Movimentação manual (${data.tipo_movimentacao})`,
      id_produto: prod.id_produto,
      produto_nome: prod.nome_produto,
      codigo_barras: prod.codigo_barras,
      unidade: prod.unidade,
      valor_unitario: data.tipo_movimentacao === 'Saída' ? prod.preco_venda : prod.preco_custo,
      id_usuario: 2,
      usuario_nome: 'Henry Sena'
    });
  }

  // Vendas / PDV (RF 07, RF 08, RF 09)
  realizarVenda(data) {
    if (!data.itens || !data.itens.length) {
      throw new Error('Nenhum item inserido na venda.');
    }

    // Validar estoque disponível para todos os itens primeiro (RF 08 e Cenário 7/9)
    for (const item of data.itens) {
      const prod = this.getProductById(item.id_produto);
      if (!prod) throw new Error(`Produto código #${item.id_produto} não localizado.`);
      if (prod.quantidade_estoque < Number(item.quantidade)) {
        throw new Error(`Quantidade indisponível em estoque para "${prod.nome_produto}"! Solicitado: ${item.quantidade}, Em estoque: ${prod.quantidade_estoque} ${prod.unidade}.`);
      }
    }

    // Baixa automática no estoque (RF 08)
    const itensProcessados = [];
    let subtotalGeral = 0;

    data.itens.forEach((item, index) => {
      const prod = this.getProductById(item.id_produto);
      const qtd = Number(item.quantidade);
      const precoUnit = Number(item.valor_unitario) || prod.preco_venda;
      const subtotal = qtd * precoUnit;

      prod.quantidade_estoque -= qtd;
      subtotalGeral += subtotal;

      itensProcessados.push({
        id_item_venda: index + 1,
        id_produto: prod.id_produto,
        nome_produto: prod.nome_produto,
        quantidade: qtd,
        unidade: prod.unidade,
        valor_unitario: precoUnit,
        subtotal: subtotal
      });

      // Gera movimentação de saída
      this.addMovimentacao({
        tipo_movimentacao: 'Saída',
        quantidade: qtd,
        observacao: `Baixa automática de venda no balcão`,
        id_produto: prod.id_produto,
        produto_nome: prod.nome_produto,
        codigo_barras: prod.codigo_barras,
        unidade: prod.unidade,
        valor_unitario: precoUnit,
        valor_total: subtotal,
        id_usuario: 2,
        usuario_nome: 'Henry Sena'
      });
    });

    const desconto = Number(data.desconto) || 0;
    const totalFinal = Math.max(0, subtotalGeral - desconto);

    const now = new Date();
    const dataFormatada = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const newId = this.vendas.length ? Math.max(...this.vendas.map(v => v.id_venda)) + 1 : 1;

    const novaVenda = {
      id_venda: newId,
      codigo_venda: `VENDA-${1000 + newId}`,
      data_venda: dataFormatada,
      valor_total: totalFinal,
      desconto: desconto,
      forma_pagamento: data.forma_pagamento || 'Dinheiro',
      status_venda: 'Concluída',
      id_usuario: 2,
      usuario_nome: 'Henry Sena',
      itens: itensProcessados
    };

    this.vendas.unshift(novaVenda);
    return novaVenda;
  }

  cancelarVenda(idVenda) {
    const venda = this.vendas.find(v => v.id_venda === Number(idVenda));
    if (!venda) throw new Error('Venda não encontrada.');
    if (venda.status_venda === 'Cancelada') throw new Error('Esta venda já está cancelada.');

    // Estorno automático no estoque (RF 09)
    venda.itens.forEach(item => {
      const prod = this.getProductById(item.id_produto);
      if (prod) {
        prod.quantidade_estoque += Number(item.quantidade);
        this.addMovimentacao({
          tipo_movimentacao: 'Entrada',
          quantidade: item.quantidade,
          observacao: `Estorno de estoque por cancelamento da ${venda.codigo_venda}`,
          id_produto: prod.id_produto,
          produto_nome: prod.nome_produto,
          codigo_barras: prod.codigo_barras,
          unidade: prod.unidade,
          valor_unitario: item.valor_unitario,
          valor_total: item.subtotal,
          id_usuario: 1,
          usuario_nome: 'Francisco (Gerente)'
        });
      }
    });

    venda.status_venda = 'Cancelada';
    return venda;
  }

  // Conferência de Inventário Físico (RF 06)
  salvarConferencia(responsavel, itensConferidos, observacao = '') {
    const now = new Date();
    const dataFormatada = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const newId = this.conferencias.length ? Math.max(...this.conferencias.map(c => c.id_conferencia)) + 1 : 1;

    const itensProcessados = itensConferidos.map(item => {
      const prod = this.getProductById(item.id_produto);
      const qtdFisica = Number(item.quantidade_fisica);
      const qtdSistema = prod ? Number(prod.quantidade_estoque) : 0;
      const divergencia = qtdFisica - qtdSistema;

      // Se atualizar o estoque real conforme contagem física
      if (prod && item.ajustarEstoque) {
        prod.quantidade_estoque = qtdFisica;
      }

      return {
        id_produto: item.id_produto,
        nome_produto: prod ? prod.nome_produto : 'Item',
        unidade: prod ? prod.unidade : 'UN',
        lote: prod ? prod.lote : '-',
        quantidade_sistema: qtdSistema,
        quantidade_fisica: qtdFisica,
        divergencia: divergencia
      };
    });

    const conferencia = {
      id_conferencia: newId,
      data_conferencia: dataFormatada,
      responsavel: responsavel || 'Henry Sena',
      observacao: observacao,
      itens: itensProcessados
    };

    this.conferencias.unshift(conferencia);
    return conferencia;
  }

  // Relatório de Vendas (RF 12)
  getRelatorioVendas() {
    // Agrupa todos os itens vendidos no dia
    const produtosVendidosMap = {};
    let totalFaturamento = 0;

    this.vendas
      .filter(v => v.status_venda === 'Concluída')
      .forEach(v => {
        totalFaturamento += Number(v.valor_total);
        v.itens.forEach(item => {
          if (!produtosVendidosMap[item.id_produto]) {
            produtosVendidosMap[item.id_produto] = {
              id_produto: item.id_produto,
              nome_produto: item.nome_produto,
              quantidade: 0,
              valor_unitario: item.valor_unitario,
              total: 0
            };
          }
          produtosVendidosMap[item.id_produto].quantidade += Number(item.quantidade);
          produtosVendidosMap[item.id_produto].total += Number(item.subtotal);
        });
      });

    const ranking = Object.values(produtosVendidosMap).sort((a, b) => b.total - a.total);

    return {
      totalGeral: totalFaturamento,
      itensVendidos: ranking,
      quantidadeTransacoes: this.vendas.filter(v => v.status_venda === 'Concluída').length,
      historicoVendas: this.vendas
    };
  }
}

module.exports = new MockDatabase();
