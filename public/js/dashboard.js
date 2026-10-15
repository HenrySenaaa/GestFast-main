// dashboard.js - Painel inicial: indicadores, alertas de estoque, compras e gráfico (RF 10 / RF 11)
(function () {
  'use strict';
  const GF = window.GF, $ = GF.$, esc = GF.esc;
  const CORES = ['#2563eb', '#f97316', '#374151', '#10b981', '#8b5cf6'];
  let timer = null, carregando = false;

  GF.badgeSit = s => `<span class="badge-status-pill ${({ 'Em Aberto': 'badge-warning', 'Cotado': 'badge-info', 'AF Gerada': 'badge-info', 'Finalizado': 'badge-success', 'Cancelado': 'badge-urgent' })[s] || 'badge-info'}">${esc(s)}</span>`;

  function drawChart(dist) {
    const cv = $('#stockDistributionCanvas'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const total = dist.reduce((acc, c) => acc + Number(c.quantidade), 0);
    if (!total) return;
    let ini = -0.5 * Math.PI;
    dist.forEach((item, i) => {
      const fatia = (Number(item.quantidade) / total) * 2 * Math.PI;
      ctx.beginPath(); ctx.moveTo(110, 110); ctx.arc(110, 110, 95, ini, ini + fatia);
      ctx.fillStyle = CORES[i % CORES.length]; ctx.fill();
      ctx.strokeStyle = '#dedede'; ctx.lineWidth = 2.5; ctx.stroke();
      ini += fatia;
    });
  }

  function render(d) {
    const al = $('#dash-alertas-figma-list');
    al.innerHTML = d.alertas.length ? d.alertas.map(a => `
      <div class="figma-data-row${GF.can('requisicoes:criar') ? ' row-click' : ''}" data-pedir="${a.id_produto}" title="${esc(a.mensagem)} (mínimo ${GF.qty(a.estoque_minimo)} ${esc(a.unidade)})${GF.can('requisicoes:criar') ? ' - clique para criar uma requisição' : ''}">
        <span>${esc(a.nome_produto)}</span>
        <span class="val-highlight">${GF.qty(a.quantidade_estoque)}</span>
      </div>`).join('') : '<div class="figma-data-row"><span>Todos os itens com estoque regular</span><span class="val-highlight">OK</span></div>';

    const val = d.validades;
    $('#dash-validade-resumo').textContent = val.itens.length ? `${val.vencidos} vencido(s) • ${val.itens.length - val.vencidos} vencendo em até ${val.dias} dia(s)` : '';
    const perda = GF.can('movimentos:registrar');
    $('#dash-validade-list').innerHTML = val.itens.length ? val.itens.map(i => `
      <div class="figma-data-row${perda ? ' row-click' : ''}" data-perda="${i.id_produto}" data-qtd="${i.quantidade_estoque}" title="Lote ${esc(i.lote || '-')} • validade ${GF.date(i.validade)} • ${GF.qty(i.quantidade_estoque)} ${esc(i.unidade)} (${GF.money(i.valor_em_risco)} no custo)${perda ? ' - clique para dar baixa como perda' : ''}">
        <span>${esc(i.nome_produto)}</span>
        <span class="val-highlight ${i.dias_restantes < 0 ? 'val-vencido' : 'val-vencendo'}">${i.dias_restantes < 0 ? `Vencido (${GF.date(i.validade)})` : i.dias_restantes === 0 ? 'Vence hoje' : `${i.dias_restantes} dia(s)`}</span>
      </div>`).join('') : '<div class="figma-data-row"><span>Nenhum produto vencido ou perto de vencer</span><span class="val-highlight">OK</span></div>';

    $('#dash-compras-figma-list').innerHTML = d.ultimasCompras.length ? d.ultimasCompras.map(c => `
      <div class="figma-data-row row-click" data-req="${c.id_requisicao}" tabindex="0" role="button" title="${esc(c.codigo_pedido)} • ${esc(c.fornecedor)} • ${esc(c.situacao)}">
        <span>${esc(c.produto_nome)}</span>
        <span class="val-highlight">x${GF.qty(c.quantidade_pedida)}</span>
      </div>`).join('') : '<div class="figma-data-row"><span>Nenhuma compra recente</span></div>';

    drawChart(d.distribuicaoEstoque);
    $('#dash-chart-legend').innerHTML = d.distribuicaoEstoque.map((x, i) => `
      <div class="figma-legend-item"><div><span class="legend-square" style="background:${CORES[i % CORES.length]};"></span><span>${esc(x.categoria)}</span></div><strong>${esc(x.porcentagem)}%</strong></div>`).join('');
  }

  async function atualizar(manual) {
    if (carregando) return;
    carregando = true;
    try {
      const r = await GF.get('/api/dashboard', true);
      render(r.data);
      $('#dash-error').classList.add('is-hidden');
      $('#dash-last-sync-time').textContent = `Última sincronização: ${new Date().toLocaleTimeString()} (Latência do banco: ${r.latencyMs || 10}ms)`;
      $('#dash-interval-text').textContent = `Atualização periódica a cada ${Math.max(2, Number(GF.state.settings.intervaloAtualizacaoSeg) || 3)}s (Tempo de resposta do banco: ~${r.latencyMs || 10}ms)`;
      if (manual) GF.toast('Dashboard sincronizado em tempo real.', 'info');
    } catch (e) {
      if (e.status !== 401) $('#dash-error').classList.remove('is-hidden');
    } finally { carregando = false; }
  }

  function start() {
    stop();
    const s = Math.max(2, Number(GF.state.settings.intervaloAtualizacaoSeg) || 3);
    
    timer = setInterval(() => { if (!document.hidden) atualizar(false); }, s * 1000);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  GF.views.dashboard = {
    stop,
    load: async () => {
      try { GF.state.settings = (await GF.get('/api/settings', true)).settings; } catch (e) { /* mantém */ }
      await atualizar(false);
      start();
    }
  };

  GF.initDashboard = () => {
    $('#btn-dash-force-sync').addEventListener('click', () => atualizar(true));
    $('#btn-dash-nova-requisicao').addEventListener('click', () => GF.views.requisicoes.abrirNova());
    $('#dash-btn-ir-estoque').addEventListener('click', () => GF.navigate('estoque'));
    $('#dash-btn-ir-pdv').addEventListener('click', () => GF.navigate('vendas'));
    $('#dash-btn-ir-requisicao').addEventListener('click', () => GF.navigate('requisicoes'));
    GF.delegate($('#dash-alertas-figma-list'), 'click', '[data-pedir]', (e, b) => GF.views.requisicoes.abrirNova(Number(b.dataset.pedir)));
    GF.delegate($('#dash-validade-list'), 'click', '[data-perda]', (e, row) => {
      if (!GF.can('movimentos:registrar')) return;
      GF.abrirPerda({ id_produto: Number(row.dataset.perda), quantidade: Number(row.dataset.qtd), motivo: 'Vencido', aoSalvar: () => atualizar(false) });
    });
    const abrirReq = (e, row) => { GF.views.requisicoes.selecionar = Number(row.dataset.req); GF.navigate('requisicoes'); };
    GF.delegate($('#dash-compras-figma-list'), 'click', '[data-req]', abrirReq);
    GF.delegate($('#dash-compras-figma-list'), 'keydown', '[data-req]', (e, row) => { if (e.key === 'Enter') abrirReq(e, row); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && GF.state.currentView === 'dashboard' && GF.state.user) atualizar(false); });
  };
})();
