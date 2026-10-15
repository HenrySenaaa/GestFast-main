// movimentos.js - Entradas e saídas de estoque, individuais ou em lote (RF 04)
(function () {
  'use strict';
  const GF = window.GF, $ = GF.$, esc = GF.esc;
  let produtos = [];

  function tabela(tipo, corpo, resumo, de, ate) {
    return async () => {
      const q = [`tipo=${tipo}`, $(de).value && `from=${$(de).value}`, $(ate).value && `to=${$(ate).value}`].filter(Boolean).join('&');
      try {
        const movs = (await GF.get(`/api/movements?${q}`)).movements;
        const total = movs.reduce((a, m) => a + m.valor_total, 0);
        $(resumo).textContent = `${movs.length} registro(s) • total ${GF.money(total)}`;
        $(corpo).innerHTML = movs.length ? movs.map(m => `<tr>
          <td>${GF.date(m.data_movimentacao)}</td><td>${esc(m.produto_nome)}</td><td>${esc(m.codigo_barras)}</td>
          <td>${GF.qty(m.quantidade)} ${esc(m.unidade)}</td><td>${GF.num2(m.valor_unitario)}</td><td>${GF.num2(m.valor_total)}</td>
          <td>${esc(m.usuario_nome)}</td><td>${esc(m.observacao)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty-cell">Nenhuma movimentação encontrada.</td></tr>';
      } catch (e) { $(corpo).innerHTML = '<tr><td colspan="8" class="empty-cell">Falha ao carregar as movimentações.</td></tr>'; }
    };
  }
  const carregarSaidas = tabela('Saída', '#saidas-tabela-corpo', '#saidas-resumo', '#saidas-de', '#saidas-ate');
  const carregarEntradas = tabela('Entrada', '#entradas-tabela-corpo', '#entradas-resumo', '#entradas-de', '#entradas-ate');

  // ---- modal com linhas (lote)
  function linhaHtml() {
    return `<div class="mov-linha"><select class="mov-prod" aria-label="Produto">${produtos.map(p => `<option value="${p.id_produto}" data-un="${esc(p.unidade)}" data-est="${p.quantidade_estoque}">${esc(p.nome_produto)} (${GF.qty(p.quantidade_estoque)} ${esc(p.unidade)})</option>`).join('')}</select>
      <input type="number" class="mov-qtd" min="1" step="1" value="1" aria-label="Quantidade"><button type="button" class="btn-icon btn-action-cancel mov-rem" title="Remover linha" aria-label="Remover linha">✕</button></div>`;
  }
  function ajustaLinha(div) {
    const opt = $('.mov-prod', div).selectedOptions[0];
    GF.applyQtyAttrs($('.mov-qtd', div), opt.dataset.un);
  }
  function addLinha() {
    const box = $('#mov-linhas');
    box.insertAdjacentHTML('beforeend', linhaHtml());
    ajustaLinha(box.lastElementChild);
    GF.$$('.mov-rem', box).forEach(b => { b.style.visibility = box.children.length > 1 ? 'visible' : 'hidden'; });
  }

  async function abrir(tipo) {
    try { produtos = (await GF.get('/api/products')).products; } catch (e) { return; }
    if (!produtos.length) { GF.toast('Não há produtos ativos cadastrados.', 'error'); return; }
    $('#modal-mov-tipo').value = tipo;
    $('#modal-mov-titulo').textContent = tipo === 'Entrada' ? 'Registrar Entrada de Estoque' : 'Registrar Saída de Estoque';
    $('#btn-registrar-mov').className = `btn ${tipo === 'Entrada' ? 'btn-primary' : 'btn-danger'}`;
    $('#mov-linhas').innerHTML = '';
    addLinha();
    $('#modal-mov-obs').value = '';
    $('#modal-mov-obs').dispatchEvent(new Event('input'));
    GF.limparErros($('#form-movimentacao-modal'));
    GF.showModalStatic('#modal-movimentacao');
  }

  async function enviar(e) {
    e.preventDefault();
    GF.limparErros($('#form-movimentacao-modal'));
    const itens = [];
    for (const div of GF.$$('.mov-linha')) {
      const q = $('.mov-qtd', div), v = Number(q.value);
      if (!(v > 0)) { GF.marcarErro(q); GF.toast('Informe quantidades maiores que zero.', 'error'); return; }
      itens.push({ id_produto: Number($('.mov-prod', div).value), quantidade: v });
    }
    const obs = $('#modal-mov-obs').value.trim();
    if (obs.length < 10) { GF.marcarErro($('#modal-mov-obs')); GF.toast('O motivo deve ter entre 10 e 5000 caracteres.', 'error'); return; }
    const btn = $('#btn-registrar-mov'); btn.disabled = true;
    try {
      const r = await GF.post('/api/movements', { tipo_movimentacao: $('#modal-mov-tipo').value, itens, observacao: obs });
      GF.toast(r.message, 'success');
      GF.hideModalStatic('#modal-movimentacao');
      if (GF.state.currentView === 'saidas') carregarSaidas(); else carregarEntradas();
    } catch (err) { /* toast exibido; nada foi gravado */ } finally { btn.disabled = false; }
  }

  GF.views.saidas = { load: carregarSaidas };
  GF.views.entradas = { load: carregarEntradas };

  GF.initMovimentos = () => {
    $('#btn-registrar-saida-modal').addEventListener('click', () => abrir('Saída'));
    $('#btn-registrar-entrada-modal').addEventListener('click', () => abrir('Entrada'));
    ['#btn-fechar-modal-mov', '#btn-cancelar-modal-mov'].forEach(s => $(s).addEventListener('click', () => GF.hideModalStatic('#modal-movimentacao')));
    $('#btn-mov-add-linha').addEventListener('click', addLinha);
    $('#form-movimentacao-modal').addEventListener('submit', enviar);
    GF.bindCounter($('#modal-mov-obs'), $('#mov-obs-counter'), 10, 5000);
    const box = $('#mov-linhas');
    box.addEventListener('change', e => { if (e.target.classList.contains('mov-prod')) ajustaLinha(e.target.closest('.mov-linha')); });
    box.addEventListener('click', e => {
      const b = e.target.closest('.mov-rem'); if (!b) return;
      if (box.children.length > 1) { b.closest('.mov-linha').remove(); GF.$$('.mov-rem', box).forEach(x => { x.style.visibility = box.children.length > 1 ? 'visible' : 'hidden'; }); }
    });
    [['#saidas-de', '#saidas-ate', carregarSaidas, '#saidas-limpar'], ['#entradas-de', '#entradas-ate', carregarEntradas, '#entradas-limpar']].forEach(([a, b, fn, l]) => {
      $(a).addEventListener('change', fn); $(b).addEventListener('change', fn);
      $(l).addEventListener('click', () => { $(a).value = ''; $(b).value = ''; fn(); });
    });
  };
})();
