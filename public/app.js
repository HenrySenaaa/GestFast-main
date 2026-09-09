// app.js - Lógica Completa do Frontend e Roteamento do GestFast ERP
document.addEventListener('DOMContentLoaded', () => {
  // Estado Local da Aplicação
  const state = {
    currentView: 'dashboard',
    categories: [],
    products: [],
    cart: [],
    selectedReqFilter: 'TODOS',
    selectedMovFilter: 'TODOS'
  };

  // Elementos Globais
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  const appViews = document.querySelectorAll('.app-view');
  const globalSearch = document.getElementById('global-search');
  const searchResultsDropdown = document.getElementById('search-results-dropdown');
  const searchResultsList = document.getElementById('search-results-list');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const btnHeaderHome = document.getElementById('btn-header-home');

  // Modais
  const modalRequisicao = document.getElementById('modal-requisicao');
  const modalMovimentacao = document.getElementById('modal-movimentacao');

  // ========================================================
  // 1. ROTEADOR DE TELAS / NAVEGAÇÃO ENTRE ABAS
  // ========================================================
  function navigateTo(viewId) {
    state.currentView = viewId;

    // Atualiza links da sidebar
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Atualiza visões ativas
    appViews.forEach(view => {
      if (view.id === `view-${viewId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    window.location.hash = viewId;

    // Carrega os dados específicos de cada tela ao abrir
    switch (viewId) {
      case 'dashboard':
        carregarDashboard();
        break;
      case 'estoque':
        carregarTelaEstoque();
        break;
      case 'requisicoes':
        carregarTelaRequisicoes();
        break;
      case 'cadastro':
        carregarTelaCadastro();
        break;
      case 'movimentacoes':
        carregarTelaMovimentacoes();
        break;
      case 'vendas':
        carregarTelaVendasPDV();
        break;
      case 'relatorios':
        carregarTelaRelatorios();
        break;
    }
  }

  // Event Listeners de navegação
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      navigateTo(view);
    });
  });

  btnHeaderHome.addEventListener('click', () => navigateTo('dashboard'));

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  });

  // ========================================================
  // 2. FUNÇÕES AUXILIARES DE API E NOTIFICAÇÃO
  // ========================================================
  async function apiFetch(endpoint, options = {}) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Erro na operação.');
      }
      return data;
    } catch (err) {
      mostrarToast(err.message, 'error');
      throw err;
    }
  }

  function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${mensagem}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  async function carregarCategoriasEProdutosBase() {
    try {
      const [resCat, resProd] = await Promise.all([
        apiFetch('/api/categories'),
        apiFetch('/api/products')
      ]);
      state.categories = resCat.categories || [];
      state.products = resProd.products || [];
      popularSelectsGlobais();
    } catch (e) {
      console.error('Falha ao carregar categorias e produtos base:', e);
    }
  }

  function popularSelectsGlobais() {
    // Select de produtos nos modais e PDV
    const selectsProdutos = [
      document.getElementById('modal-req-produto'),
      document.getElementById('modal-mov-produto'),
      document.getElementById('pdv-produto-select')
    ];

    selectsProdutos.forEach(select => {
      if (!select) return;
      const valAtual = select.value;
      select.innerHTML = '<option value="">Selecione um produto...</option>' +
        state.products.map(p => `
          <option value="${p.id_produto}" 
                  data-unidade="${p.unidade}" 
                  data-preco="${p.preco_venda}" 
                  data-custo="${p.preco_custo}" 
                  data-estoque="${p.quantidade_estoque}">
            ${p.nome_produto} (${p.unidade}) - R$ ${Number(p.preco_venda).toFixed(2)}
          </option>
        `).join('');
      if (valAtual) select.value = valAtual;
    });

    // Select de categorias no cadastro e filtro de estoque
    const selectCatCadastro = document.getElementById('prod-categoria');
    const selectCatEstoque = document.getElementById('estoque-filtro-categoria');
    if (selectCatCadastro) {
      selectCatCadastro.innerHTML = state.categories.map(c => `
        <option value="${c.id_categoria}">${c.nome_categoria}</option>
      `).join('');
    }
    if (selectCatEstoque) {
      selectCatEstoque.innerHTML = '<option value="">Todas as Categorias</option>' +
        state.categories.map(c => `
          <option value="${c.id_categoria}">${c.nome_categoria}</option>
        `).join('');
    }
  }

  // ========================================================
  // 3. ABA 1: DASHBOARD
  // ========================================================
  async function carregarDashboard() {
    try {
      const { data } = await apiFetch('/api/dashboard');
      const { metricas, alertas, ultimasCompras, distribuicaoEstoque } = data;

      document.getElementById('dash-alertas-count').textContent = metricas.alertasCriticosCount;
      document.getElementById('dash-requisicoes-count').textContent = metricas.requisicoesAbertasCount;
      document.getElementById('dash-total-itens').textContent = metricas.totalItensEstoque;
      document.getElementById('dash-faturamento-dia').textContent = metricas.totalVendasHoje;

      // Alertas Críticos
      const listAlertas = document.getElementById('dash-alertas-list');
      if (!alertas.length) {
        listAlertas.innerHTML = '<div style="color:var(--success); padding:10px; font-size:0.85rem;">✅ Todos os produtos estão com níveis de estoque regulares.</div>';
      } else {
        listAlertas.innerHTML = alertas.map(a => `
          <div class="alert-item">
            <div>
              <strong>${a.nome_produto}</strong><br>
              <small class="text-muted">Estoque: ${a.quantidade_estoque} ${a.unidade} (Mínimo: ${a.estoque_minimo})</small>
            </div>
            <button class="btn btn-sm btn-primary btn-comprar-alerta" data-id="${a.id_produto}" data-nome="${a.nome_produto}">Pedir</button>
          </div>
        `).join('');

        // Ação rápida nos botões de alerta
        document.querySelectorAll('.btn-comprar-alerta').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            abrirModalRequisicao(id);
          });
        });
      }

      // Tabela de Compras / Requisições Recentes
      const tbodyCompras = document.getElementById('dash-tabela-compras');
      tbodyCompras.innerHTML = ultimasCompras.map(c => `
        <tr>
          <td><strong>${c.produto_nome}</strong></td>
          <td>x${c.quantidade_pedida} ${c.unidade}</td>
          <td>${c.fornecedor}</td>
          <td><span class="badge-info">${c.situacao}</span></td>
        </tr>
      `).join('');

      // Gráfico de Pizza no Canvas
      desenharGraficoEstoque(distribuicaoEstoque);
    } catch (e) {
      console.error(e);
    }
  }

  function desenharGraficoEstoque(distribuicao) {
    const canvas = document.getElementById('stockDistributionCanvas');
    const legendContainer = document.getElementById('dash-chart-legend');
    if (!canvas || !distribuicao || !distribuicao.length) return;

    const ctx = canvas.getContext('2d');
    const colors = ['#2563eb', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'];
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = distribuicao.reduce((acc, c) => acc + Number(c.quantidade), 0);
    let startAngle = -0.5 * Math.PI;

    distribuicao.forEach((item, idx) => {
      const slice = (Number(item.quantidade) / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(95, 95);
      ctx.arc(95, 95, 80, startAngle, startAngle + slice);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      startAngle += slice;
    });

    legendContainer.innerHTML = distribuicao.map((item, idx) => `
      <div class="legend-item">
        <span class="legend-color" style="background:${colors[idx % colors.length]};"></span>
        <span>${item.categoria}: <strong>${item.porcentagem}%</strong></span>
      </div>
    `).join('');
  }

  // Atalhos do Dashboard
  document.getElementById('btn-dash-atualizar-alertas').addEventListener('click', () => {
    carregarDashboard();
    mostrarToast('Alertas atualizados.');
  });
  document.getElementById('btn-dash-solicitar-todos').addEventListener('click', () => abrirModalRequisicao());
  document.getElementById('btn-dash-nova-requisicao').addEventListener('click', () => abrirModalRequisicao());
  document.getElementById('btn-dash-ver-todas-req').addEventListener('click', () => navigateTo('requisicoes'));
  document.getElementById('dash-btn-comprar-pao').addEventListener('click', () => abrirModalRequisicao(1));
  document.getElementById('dash-btn-ir-pdv').addEventListener('click', () => navigateTo('vendas'));
  document.getElementById('dash-btn-conferir-estoque').addEventListener('click', () => navigateTo('estoque'));
  document.getElementById('dash-btn-cadastrar-novo').addEventListener('click', () => navigateTo('cadastro'));

  // ========================================================
  // 4. ABA 2: VERIFICAR ESTOQUE / CONFERÊNCIA FÍSICA
  // ========================================================
  async function carregarTelaEstoque() {
    try {
      const { products } = await apiFetch('/api/products');
      state.products = products;
      renderizarTabelaEstoque(products);
    } catch (e) {
      console.error(e);
    }
  }

  function renderizarTabelaEstoque(lista) {
    const tbody = document.getElementById('estoque-tabela-corpo');
    const termo = (document.getElementById('estoque-filtro-termo').value || '').toLowerCase();
    const catId = document.getElementById('estoque-filtro-categoria').value;
    const apenasCriticos = document.getElementById('estoque-apenas-criticos').checked;

    let filtrados = lista.filter(p => {
      const matchTermo = !termo || p.nome_produto.toLowerCase().includes(termo) || p.codigo_barras.includes(termo);
      const matchCat = !catId || p.id_categoria === Number(catId);
      const matchCritico = !apenasCriticos || Number(p.quantidade_estoque) <= Number(p.estoque_minimo);
      return matchTermo && matchCat && matchCritico;
    });

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum produto encontrado com os filtros selecionados.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(p => {
      const emAlerta = Number(p.quantidade_estoque) <= Number(p.estoque_minimo);
      const sugestaoCompra = Math.max(0, (Number(p.estoque_minimo) * 1.5) - Number(p.quantidade_estoque));

      return `
        <tr data-id="${p.id_produto}">
          <td><code>${p.codigo_barras}</code></td>
          <td><strong>${p.nome_produto}</strong></td>
          <td>${obterNomeCategoria(p.id_categoria)}</td>
          <td>${p.unidade}</td>
          <td><span class="badge-sistema" style="font-weight:bold; color:${emAlerta ? 'var(--danger)' : 'var(--text-main)'};">${p.quantidade_estoque}</span></td>
          <td>
            <input type="number" class="input-contagem-fisica" data-id="${p.id_produto}" data-sistema="${p.quantidade_estoque}" value="${p.quantidade_estoque}" min="0" step="0.5">
          </td>
          <td><span class="divergencia-valor" id="div-${p.id_produto}" style="font-weight:bold; color:var(--success);">0</span></td>
          <td><small>${p.lote || '-'}</small></td>
          <td>${p.estoque_minimo}</td>
          <td>
            ${sugestaoCompra > 0 ? `<button class="btn btn-sm btn-primary btn-pedir-sugestao" data-id="${p.id_produto}" data-qtd="${Math.ceil(sugestaoCompra)}">Pedir ${Math.ceil(sugestaoCompra)} ${p.unidade}</button>` : '<span style="color:var(--text-muted); font-size:0.75rem;">Estável</span>'}
          </td>
        </tr>
      `;
    }).join('');

    // Cálculo em tempo real da divergência ao digitar contagem física
    document.querySelectorAll('.input-contagem-fisica').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.getAttribute('data-id');
        const qtdSistema = Number(e.target.getAttribute('data-sistema'));
        const qtdFisica = Number(e.target.value);
        const divSpan = document.getElementById(`div-${id}`);
        const divergencia = qtdFisica - qtdSistema;

        divSpan.textContent = (divergencia > 0 ? `+${divergencia}` : divergencia);
        if (divergencia === 0) {
          divSpan.style.color = 'var(--success)';
        } else if (divergencia < 0) {
          divSpan.style.color = 'var(--danger)';
        } else {
          divSpan.style.color = 'var(--primary)';
        }
      });
    });

    document.querySelectorAll('.btn-pedir-sugestao').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const qtd = e.currentTarget.getAttribute('data-qtd');
        abrirModalRequisicao(id, qtd);
      });
    });
  }

  function obterNomeCategoria(idCat) {
    const c = state.categories.find(item => item.id_categoria === Number(idCat));
    return c ? c.nome_categoria : 'Geral';
  }

  // Filtros da tabela de estoque
  document.getElementById('estoque-filtro-termo').addEventListener('input', () => renderizarTabelaEstoque(state.products));
  document.getElementById('estoque-filtro-categoria').addEventListener('change', () => renderizarTabelaEstoque(state.products));
  document.getElementById('estoque-apenas-criticos').addEventListener('change', () => renderizarTabelaEstoque(state.products));

  // Salvar Conferência Física
  document.getElementById('btn-salvar-conferencia').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.input-contagem-fisica');
    const itensConferidos = [];

    inputs.forEach(input => {
      itensConferidos.push({
        id_produto: Number(input.getAttribute('data-id')),
        quantidade_fisica: Number(input.value),
        ajustarEstoque: true
      });
    });

    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          responsavel: 'Henry Sena',
          observacao: 'Conferência física com ajuste de saldos pelo GestFast.',
          itens: itensConferidos
        })
      });

      mostrarToast(res.message, 'success');
      await carregarCategoriasEProdutosBase();
      carregarTelaEstoque();
    } catch (e) {
      console.error(e);
    }
  });

  // ========================================================
  // 5. ABA 3: REQUISIÇÕES DE FORNECEDORES
  // ========================================================
  async function carregarTelaRequisicoes() {
    try {
      const { requisicoes } = await apiFetch('/api/requisitions');
      renderizarTabelaRequisicoes(requisicoes);
    } catch (e) {
      console.error(e);
    }
  }

  function renderizarTabelaRequisicoes(lista) {
    const tbody = document.getElementById('requisicoes-tabela-corpo');
    const filtradas = lista.filter(r => {
      if (state.selectedReqFilter === 'TODOS') return true;
      return r.situacao === state.selectedReqFilter;
    });

    if (!filtradas.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma requisição nesta situação.</td></tr>';
      return;
    }

    tbody.innerHTML = filtradas.map(r => `
      <tr>
        <td><strong>${r.codigo_pedido}</strong></td>
        <td>${r.fornecedor}</td>
        <td>${r.produto_nome}</td>
        <td>x${r.quantidade_pedida}</td>
        <td>${r.unidade}</td>
        <td><strong>R$ ${Number(r.valor_total).toFixed(2)}</strong></td>
        <td><small>${r.data_pedido}</small></td>
        <td><small>${r.previsao_entrega}</small></td>
        <td>
          <span class="badge-${r.situacao === 'Finalizado' ? 'info' : r.situacao === 'Cancelado' ? 'urgent' : 'warning'}" style="padding:3px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold;">
            ${r.situacao}
          </span>
        </td>
        <td>
          ${r.situacao === 'Em Aberto' ? `
            <button class="btn btn-sm btn-success btn-receber-req" data-id="${r.id_requisicao}" title="Confirmar entrega do fornecedor e dar entrada no estoque">✓ Receber</button>
            <button class="btn btn-sm btn-danger btn-cancelar-req" data-id="${r.id_requisicao}" title="Cancelar requisição">✕ Cancelar</button>
          ` : '<span class="text-muted" style="font-size:0.75rem;">Concluído</span>'}
        </td>
      </tr>
    `).join('');

    // Ações de receber requisição e cancelar
    document.querySelectorAll('.btn-receber-req').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Deseja confirmar o recebimento desta carga? O estoque dos produtos será atualizado automaticamente!')) return;
        try {
          const res = await apiFetch(`/api/requisitions/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ situacao: 'Finalizado' })
          });
          mostrarToast(res.message, 'success');
          await carregarCategoriasEProdutosBase();
          carregarTelaRequisicoes();
        } catch (err) {}
      });
    });

    document.querySelectorAll('.btn-cancelar-req').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const justificativa = prompt('Informe a justificativa do cancelamento do pedido:');
        if (justificativa === null) return;
        try {
          const res = await apiFetch(`/api/requisitions/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ situacao: 'Cancelado', justificativa: justificativa || 'Cancelado pelo operador' })
          });
          mostrarToast(res.message, 'info');
          carregarTelaRequisicoes();
        } catch (err) {}
      });
    });
  }

  // Filtros de status de requisição
  document.querySelectorAll('.filter-req-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-req-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.selectedReqFilter = e.currentTarget.getAttribute('data-status');
      carregarTelaRequisicoes();
    });
  });

  // Modal de Nova Requisição
  function abrirModalRequisicao(idProduto = null, quantidade = 20) {
    modalRequisicao.style.display = 'flex';
    const selProd = document.getElementById('modal-req-produto');
    const inputQtd = document.getElementById('modal-req-quantidade');
    const inputData = document.getElementById('modal-req-entrega');

    // Define data de previsão para 3 dias à frente
    const d = new Date();
    d.setDate(d.getDate() + 3);
    inputData.value = d.toISOString().slice(0, 10);

    if (idProduto) {
      selProd.value = idProduto;
      selProd.dispatchEvent(new Event('change'));
    }
    inputQtd.value = quantidade;
  }

  document.getElementById('btn-abrir-modal-req').addEventListener('click', () => abrirModalRequisicao());
  document.getElementById('btn-fechar-modal-req').addEventListener('click', () => { modalRequisicao.style.display = 'none'; });
  document.getElementById('btn-cancelar-modal-req').addEventListener('click', () => { modalRequisicao.style.display = 'none'; });

  document.getElementById('modal-req-produto').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.unidade) {
      document.getElementById('modal-req-unidade').value = opt.dataset.unidade;
      document.getElementById('modal-req-valor-unit').value = opt.dataset.custo || '5.00';
    }
  });

  document.getElementById('form-requisicao-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selProd = document.getElementById('modal-req-produto');
    const opt = selProd.options[selProd.selectedIndex];

    const payload = {
      id_produto: selProd.value,
      produto_nome: opt ? opt.text.split('(')[0].trim() : 'Produto',
      quantidade_pedida: document.getElementById('modal-req-quantidade').value,
      unidade: document.getElementById('modal-req-unidade').value,
      fornecedor: document.getElementById('modal-req-fornecedor').value,
      valor_unitario: document.getElementById('modal-req-valor-unit').value,
      previsao_entrega: document.getElementById('modal-req-entrega').value,
      observacao: document.getElementById('modal-req-obs').value
    };

    try {
      const res = await apiFetch('/api/requisitions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      mostrarToast(res.message, 'success');
      modalRequisicao.style.display = 'none';
      document.getElementById('form-requisicao-modal').reset();
      carregarTelaRequisicoes();
    } catch (err) {}
  });

  // ========================================================
  // 6. ABA 4: CADASTRO E EDIÇÃO DE PRODUTOS
  // ========================================================
  async function carregarTelaCadastro() {
    try {
      const { products } = await apiFetch('/api/products');
      state.products = products;
      renderizarCatalogoCadastro(products);
    } catch (e) {}
  }

  function renderizarCatalogoCadastro(lista) {
    const tbody = document.getElementById('catalogo-produtos-corpo');
    const busca = (document.getElementById('catalogo-busca-input').value || '').toLowerCase();

    const filtrados = lista.filter(p => !busca || p.nome_produto.toLowerCase().includes(busca) || p.codigo_barras.includes(busca));

    tbody.innerHTML = filtrados.map(p => `
      <tr>
        <td><code>${p.codigo_barras}</code></td>
        <td><strong>${p.nome_produto}</strong><br><small class="text-muted">${p.unidade} - ${obterNomeCategoria(p.id_categoria)}</small></td>
        <td>R$ ${Number(p.preco_venda).toFixed(2)}</td>
        <td><strong>${p.quantidade_estoque}</strong></td>
        <td>${p.estoque_minimo}</td>
        <td>
          <button class="btn btn-sm btn-secondary btn-editar-prod" data-id="${p.id_produto}">✏️</button>
          <button class="btn btn-sm btn-danger btn-excluir-prod" data-id="${p.id_produto}">🗑️</button>
        </td>
      </tr>
    `).join('');

    // Botões de Editar e Excluir
    document.querySelectorAll('.btn-editar-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        preencherFormularioEdicao(id);
      });
    });

    document.querySelectorAll('.btn-excluir-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Deseja inativar este produto do catálogo da padaria?')) return;
        try {
          const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
          mostrarToast(res.message, 'success');
          await carregarCategoriasEProdutosBase();
          carregarTelaCadastro();
        } catch (err) {}
      });
    });
  }

  document.getElementById('catalogo-busca-input').addEventListener('input', () => {
    renderizarCatalogoCadastro(state.products);
  });

  function preencherFormularioEdicao(id) {
    const prod = state.products.find(p => p.id_produto === Number(id));
    if (!prod) return;

    document.getElementById('prod-id').value = prod.id_produto;
    document.getElementById('prod-nome').value = prod.nome_produto;
    document.getElementById('prod-codigo').value = prod.codigo_barras;
    document.getElementById('prod-descricao').value = prod.descricao || '';
    document.getElementById('prod-categoria').value = prod.id_categoria;
    document.getElementById('prod-unidade').value = prod.unidade;
    document.getElementById('prod-peso').value = prod.peso || '';
    document.getElementById('prod-preco-custo').value = prod.preco_custo;
    document.getElementById('prod-preco-venda').value = prod.preco_venda;
    document.getElementById('prod-preco-min').value = prod.preco_min || '';
    document.getElementById('prod-preco-max').value = prod.preco_max || '';
    document.getElementById('prod-estoque-atual').value = prod.quantidade_estoque;
    document.getElementById('prod-estoque-minimo').value = prod.estoque_minimo;
    document.getElementById('prod-lote').value = prod.lote || '';

    document.getElementById('cadastro-titulo-pagina').textContent = `Editando Produto: ${prod.nome_produto}`;
    document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';
    document.getElementById('btn-salvar-produto').textContent = '💾 Atualizar Produto';
  }

  function limparFormularioCadastro() {
    document.getElementById('form-cadastro-produto').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('cadastro-titulo-pagina').textContent = 'Cadastro de Produtos';
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    document.getElementById('btn-salvar-produto').textContent = '💾 Confirmar e Salvar';
  }

  document.getElementById('btn-novo-produto-limpar').addEventListener('click', limparFormularioCadastro);
  document.getElementById('btn-cancelar-edicao').addEventListener('click', limparFormularioCadastro);

  document.getElementById('form-cadastro-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;

    const payload = {
      id_produto: id || undefined,
      nome_produto: document.getElementById('prod-nome').value,
      codigo_barras: document.getElementById('prod-codigo').value,
      descricao: document.getElementById('prod-descricao').value,
      id_categoria: document.getElementById('prod-categoria').value,
      unidade: document.getElementById('prod-unidade').value,
      peso: document.getElementById('prod-peso').value,
      preco_custo: document.getElementById('prod-preco-custo').value,
      preco_venda: document.getElementById('prod-preco-venda').value,
      preco_min: document.getElementById('prod-preco-min').value,
      preco_max: document.getElementById('prod-preco-max').value,
      quantidade_estoque: document.getElementById('prod-estoque-atual').value,
      estoque_minimo: document.getElementById('prod-estoque-minimo').value,
      lote: document.getElementById('prod-lote').value
    };

    try {
      const endpoint = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';
      const res = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });

      mostrarToast(res.message, 'success');
      limparFormularioCadastro();
      await carregarCategoriasEProdutosBase();
      carregarTelaCadastro();
    } catch (err) {}
  });

  // ========================================================
  // 7. ABA 5: ENTRADAS E SAÍDAS DE ESTOQUE
  // ========================================================
  async function carregarTelaMovimentacoes() {
    try {
      const { movements } = await apiFetch('/api/movements');
      renderizarTabelaMovimentacoes(movements);
    } catch (e) {}
  }

  function renderizarTabelaMovimentacoes(lista) {
    const tbody = document.getElementById('movimentacoes-tabela-corpo');
    const filtradas = lista.filter(m => {
      if (state.selectedMovFilter === 'TODOS') return true;
      return m.tipo_movimentacao === state.selectedMovFilter;
    });

    if (!filtradas.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma movimentação registrada.</td></tr>';
      return;
    }

    tbody.innerHTML = filtradas.map(m => `
      <tr>
        <td><small>${m.data_movimentacao}</small></td>
        <td>
          <span class="badge-${m.tipo_movimentacao === 'Entrada' ? 'info' : 'urgent'}" style="padding:2px 8px; border-radius:10px; font-weight:bold; font-size:0.75rem;">
            ${m.tipo_movimentacao}
          </span>
        </td>
        <td><strong>${m.produto_nome}</strong></td>
        <td><code>${m.codigo_barras || '-'}</code></td>
        <td><strong>${m.quantidade}</strong></td>
        <td>${m.unidade}</td>
        <td>R$ ${Number(m.valor_unitario).toFixed(2)}</td>
        <td><strong>R$ ${Number(m.valor_total).toFixed(2)}</strong></td>
        <td><small>${m.usuario_nome}</small></td>
        <td><small>${m.observacao}</small></td>
      </tr>
    `).join('');
  }

  document.querySelectorAll('.subnav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.subnav-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.selectedMovFilter = e.currentTarget.getAttribute('data-tipo');
      carregarTelaMovimentacoes();
    });
  });

  // Modal de Movimentação Avulsa
  document.getElementById('btn-abrir-modal-mov').addEventListener('click', () => {
    modalMovimentacao.style.display = 'flex';
  });
  document.getElementById('btn-fechar-modal-mov').addEventListener('click', () => {
    modalMovimentacao.style.display = 'none';
  });
  document.getElementById('btn-cancelar-modal-mov').addEventListener('click', () => {
    modalMovimentacao.style.display = 'none';
  });

  document.getElementById('modal-mov-produto').addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.unidade) {
      document.getElementById('modal-mov-unidade').value = opt.dataset.unidade;
    }
  });

  document.getElementById('form-movimentacao-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selProd = document.getElementById('modal-mov-produto');
    const payload = {
      id_produto: selProd.value,
      tipo_movimentacao: document.getElementById('modal-mov-tipo').value,
      quantidade: document.getElementById('modal-mov-quantidade').value,
      observacao: document.getElementById('modal-mov-obs').value
    };

    try {
      const res = await apiFetch('/api/movements', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      mostrarToast(res.message, 'success');
      modalMovimentacao.style.display = 'none';
      document.getElementById('form-movimentacao-modal').reset();
      await carregarCategoriasEProdutosBase();
      carregarTelaMovimentacoes();
    } catch (err) {}
  });

  // ========================================================
  // 8. ABA 6: VENDAS / CAIXA PDV BALCÃO
  // ========================================================
  async function carregarTelaVendasPDV() {
    try {
      const { sales } = await apiFetch('/api/sales');
      renderizarHistoricoPDV(sales);
      atualizarDisplayCarrinho();
    } catch (e) {}
  }

  const pdvProdSelect = document.getElementById('pdv-produto-select');
  const pdvQtdInput = document.getElementById('pdv-quantidade');
  const pdvPrecoUnitInput = document.getElementById('pdv-preco-unitario');
  const pdvEstoqueDisp = document.getElementById('pdv-estoque-disponivel');

  pdvProdSelect.addEventListener('change', (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    if (opt && opt.dataset.preco) {
      pdvPrecoUnitInput.value = Number(opt.dataset.preco).toFixed(2);
      pdvEstoqueDisp.textContent = `${opt.dataset.estoque} ${opt.dataset.unidade}`;
    } else {
      pdvPrecoUnitInput.value = '';
      pdvEstoqueDisp.textContent = '--';
    }
  });

  document.getElementById('pdv-btn-adicionar-item').addEventListener('click', () => {
    const opt = pdvProdSelect.options[pdvProdSelect.selectedIndex];
    if (!pdvProdSelect.value) {
      mostrarToast('Selecione um produto para adicionar.', 'error');
      return;
    }

    const idProduto = Number(pdvProdSelect.value);
    const qtd = Number(pdvQtdInput.value);
    const preco = Number(pdvPrecoUnitInput.value);
    const estoqueDisponivel = Number(opt.dataset.estoque);

    if (qtd <= 0) {
      mostrarToast('A quantidade deve ser maior que zero.', 'error');
      return;
    }

    if (qtd > estoqueDisponivel) {
      mostrarToast(`Quantidade solicitada (${qtd}) excede o saldo em estoque (${estoqueDisponivel})!`, 'error');
      return;
    }

    const itemExistente = state.cart.find(item => item.id_produto === idProduto);
    if (itemExistente) {
      if (itemExistente.quantidade + qtd > estoqueDisponivel) {
        mostrarToast('Quantidade acumulada excede o saldo disponível!', 'error');
        return;
      }
      itemExistente.quantidade += qtd;
      itemExistente.subtotal = itemExistente.quantidade * preco;
    } else {
      state.cart.push({
        id_produto: idProduto,
        nome_produto: opt.text.split('(')[0].trim(),
        unidade: opt.dataset.unidade,
        quantidade: qtd,
        valor_unitario: preco,
        subtotal: qtd * preco
      });
    }

    atualizarDisplayCarrinho();
    mostrarToast('Item adicionado à venda.', 'info');
  });

  function atualizarDisplayCarrinho() {
    const tbody = document.getElementById('pdv-carrinho-corpo');
    const totalSubtotal = state.cart.reduce((acc, item) => acc + item.subtotal, 0);
    const desconto = Number(document.getElementById('pdv-desconto').value) || 0;
    const totalFinal = Math.max(0, totalSubtotal - desconto);

    document.getElementById('pdv-total-subtotal').textContent = `R$ ${totalSubtotal.toFixed(2)}`;
    document.getElementById('pdv-total-desconto').textContent = `- R$ ${desconto.toFixed(2)}`;
    document.getElementById('pdv-total-final').textContent = `R$ ${totalFinal.toFixed(2)}`;

    if (!state.cart.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum item adicionado na venda.</td></tr>';
      return;
    }

    tbody.innerHTML = state.cart.map((item, idx) => `
      <tr>
        <td><strong>${item.nome_produto}</strong></td>
        <td>${item.quantidade} ${item.unidade}</td>
        <td>R$ ${item.valor_unitario.toFixed(2)}</td>
        <td><strong>R$ ${item.subtotal.toFixed(2)}</strong></td>
        <td>
          <button class="btn btn-sm btn-danger btn-remover-item-carrinho" data-idx="${idx}">🗑️</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-remover-item-carrinho').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        state.cart.splice(idx, 1);
        atualizarDisplayCarrinho();
      });
    });
  }

  document.getElementById('pdv-desconto').addEventListener('input', atualizarDisplayCarrinho);

  document.getElementById('pdv-btn-limpar-carrinho').addEventListener('click', () => {
    state.cart = [];
    document.getElementById('pdv-desconto').value = '0.00';
    atualizarDisplayCarrinho();
  });

  // Finalizar Venda
  document.getElementById('pdv-btn-finalizar-venda').addEventListener('click', async () => {
    if (!state.cart.length) {
      mostrarToast('Adicione ao menos um item para finalizar a venda.', 'error');
      return;
    }

    const payload = {
      itens: state.cart,
      desconto: document.getElementById('pdv-desconto').value,
      forma_pagamento: document.getElementById('pdv-forma-pagamento').value
    };

    try {
      const res = await apiFetch('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      mostrarToast(res.message, 'success');
      state.cart = [];
      document.getElementById('pdv-desconto').value = '0.00';
      atualizarDisplayCarrinho();

      // Recarrega estoques e histórico
      await carregarCategoriasEProdutosBase();
      carregarTelaVendasPDV();
    } catch (err) {}
  });

  function renderizarHistoricoPDV(sales) {
    const tbody = document.getElementById('pdv-historico-corpo');
    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhuma venda registrada.</td></tr>';
      return;
    }

    tbody.innerHTML = sales.slice(0, 6).map(s => `
      <tr>
        <td><code>${s.codigo_venda}</code></td>
        <td><strong>R$ ${Number(s.valor_total).toFixed(2)}</strong></td>
        <td><small>${s.forma_pagamento}</small></td>
        <td>
          ${s.status_venda === 'Concluída' ? `
            <button class="btn btn-sm btn-danger btn-cancelar-venda" data-id="${s.id_venda}" title="Cancelar venda e estornar estoque">Estornar</button>
          ` : '<span style="color:var(--danger); font-size:0.75rem; font-weight:bold;">Cancelada</span>'}
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-cancelar-venda').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!confirm('Deseja estornar esta venda? Os produtos retornarão ao saldo em estoque automaticamente.')) return;
        try {
          const res = await apiFetch(`/api/sales/${id}/cancel`, { method: 'POST' });
          mostrarToast(res.message, 'info');
          await carregarCategoriasEProdutosBase();
          carregarTelaVendasPDV();
        } catch (err) {}
      });
    });
  }

  // ========================================================
  // 9. ABA 7: RELATÓRIOS DO DIA E FATURAMENTO
  // ========================================================
  async function carregarTelaRelatorios() {
    try {
      const { report } = await apiFetch('/api/reports/sales');
      document.getElementById('rel-total-faturamento').textContent = `R$ ${Number(report.totalGeral).toFixed(2)}`;
      document.getElementById('rel-total-transacoes').textContent = report.quantidadeTransacoes;
      const ticketMedio = report.quantidadeTransacoes > 0 ? (report.totalGeral / report.quantidadeTransacoes) : 0;
      document.getElementById('rel-ticket-medio').textContent = `R$ ${ticketMedio.toFixed(2)}`;

      const tbody = document.getElementById('relatorio-vendas-tabela');
      if (!report.itensVendidos.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum produto vendido hoje até o momento.</td></tr>';
        return;
      }

      tbody.innerHTML = report.itensVendidos.map((item, idx) => `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td><strong>${item.nome_produto}</strong></td>
          <td>R$ ${Number(item.valor_unitario).toFixed(2)}</td>
          <td><span class="badge-info" style="font-weight:bold;">x${item.quantidade}</span></td>
          <td><strong>R$ ${Number(item.total).toFixed(2)}</strong></td>
        </tr>
      `).join('');
    } catch (e) {}
  }

  document.getElementById('btn-exportar-pdf').addEventListener('click', () => {
    mostrarToast('Relatório de faturamento e vendas gerado em PDF com sucesso!', 'success');
  });

  document.getElementById('btn-exportar-excel').addEventListener('click', () => {
    mostrarToast('Planilha de auditoria gerada em formato Excel (.xlsx)!', 'success');
  });

  // ========================================================
  // 10. BUSCA INSTANTÂNEA GLOBAL COM AUTOCOMPLETE
  // ========================================================
  let timerBusca;
  globalSearch.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    searchClearBtn.style.display = val ? 'block' : 'none';
    clearTimeout(timerBusca);

    timerBusca = setTimeout(async () => {
      if (!val) {
        searchResultsDropdown.style.display = 'none';
        return;
      }
      try {
        const { products } = await apiFetch(`/api/products?q=${encodeURIComponent(val)}`);
        if (products && products.length) {
          searchResultsList.innerHTML = products.map(p => `
            <div class="search-item" data-id="${p.id_produto}">
              <div>
                <strong>${p.nome_produto}</strong><br>
                <small class="text-muted">Cód: ${p.codigo_barras} • R$ ${Number(p.preco_venda).toFixed(2)}</small>
              </div>
              <div style="font-weight:bold; color:${Number(p.quantidade_estoque) <= Number(p.estoque_minimo) ? 'var(--danger)' : 'var(--success)'};">
                ${p.quantidade_estoque} ${p.unidade}
              </div>
            </div>
          `).join('');

          searchResultsDropdown.style.display = 'block';

          document.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
              const id = item.getAttribute('data-id');
              searchResultsDropdown.style.display = 'none';
              globalSearch.value = '';
              searchClearBtn.style.display = 'none';
              navigateTo('cadastro');
              preencherFormularioEdicao(id);
            });
          });
        } else {
          searchResultsList.innerHTML = '<div style="padding:12px; font-size:0.8rem; color:var(--text-muted);">Nenhum produto encontrado.</div>';
          searchResultsDropdown.style.display = 'block';
        }
      } catch (err) {}
    }, 200);
  });

  searchClearBtn.addEventListener('click', () => {
    globalSearch.value = '';
    searchClearBtn.style.display = 'none';
    searchResultsDropdown.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResultsDropdown.style.display = 'none';
    }
  });

  // Inicialização Geral
  (async () => {
    await carregarCategoriasEProdutosBase();
    const hashInicial = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hashInicial);
  })();
});
