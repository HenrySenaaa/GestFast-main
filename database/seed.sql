-- =====================================================================
-- GestFast ERP — Dados de exemplo (gerado a partir do db.js)
-- Executar DEPOIS do schema.sql.
-- =====================================================================
USE gestfast;

INSERT INTO perfis (id_perfil, nome_perfil) VALUES
  (1, 'Administrador'),
  (2, 'BackOffice'),
  (3, 'Funcionario');

INSERT INTO usuarios (id_usuario, nome, email, cargo, status, data_criacao, id_perfil) VALUES
  (1, 'Francisco', 'proprietario@padarianovayork.com', 'Proprietário', 'Ativo', '2026-01-10', 1),
  (2, 'Henry Sena', 'henry@padarianovayork.com', 'Atendente / Operador de Caixa', 'Ativo', '2026-02-01', 3);

INSERT INTO categorias (id_categoria, nome_categoria, descricao) VALUES
  (1, 'Pães', 'Pães artesanais, franceses, baguetes e doces'),
  (2, 'Bebidas & Cafés', 'Cafés, sucos, refrigerantes e laticínios'),
  (3, 'Mercearia & Insumos', 'Farinhas, açúcares, fermentos e ingredientes'),
  (4, 'Confeitaria & Bolos', 'Bolos, doces, tortas e sobremesas'),
  (5, 'Frios & Derivados', 'Queijos, presuntos, manteigas e frios fatiados');

INSERT INTO fornecedores (id_fornecedor, nome) VALUES
  (1, 'Empresa Pão e Açúcar Dist.'),
  (2, 'Moinho Paulista de Trigo'),
  (3, 'Granja Santo André Ltda'),
  (4, 'Laticínios ABC'),
  (5, 'Confeitaria Doce Arte'),
  (6, 'Panificadora Central e Distribuição'),
  (7, 'Café Pilão Distribuição Direta'),
  (8, 'Distribuidora de Embalagens São Caetano');

INSERT INTO produtos (id_produto, codigo_barras, nome_produto, descricao, unidade, peso, preco_custo, preco_venda, preco_min, preco_max, quantidade_estoque, estoque_minimo, status, id_categoria, lote, validade, imagem) VALUES
  (1, '78910001', 'Pão de Queijo', 'Pão de queijo tradicional de Minas 50g assado na hora', 'UN', '50g', 1.2, 3.5, 2.5, 5, 10, 30, 'Ativo', 1, '546320', '2026-09-15', 'assets/pao.png'),
  (2, '78910002', 'Café Pilão 320g', 'Café torrado e moído tradicional 320g com notas intensas', 'Pacote', '320g', 12.5, 18.9, 15, 22, 20, 25, 'Ativo', 2, '548417', '2026-12-20', 'assets/cafe.png'),
  (3, '78910003', 'Bolo de Cenoura', 'Bolo caseiro de cenoura com calda generosa de chocolate', 'Fatia', '120g', 4.5, 12, 9, 16, 4, 12, 'Ativo', 4, '546328', '2026-09-12', 'assets/bolo.png'),
  (4, '78910004', 'Pão Francês', 'Pão francês artesanal crocante assado de hora em hora', 'KG', '1000g', 5.5, 16.9, 14, 19.9, 70, 30, 'Ativo', 1, '545846', '2026-09-10', 'assets/pao_frances.png'),
  (5, '78910005', 'Açúcar Cristal 1kg', 'Açúcar cristal refinado 1kg para receitas e café', 'Pacote', '1000g', 3.2, 5.5, 4, 7, 12, 20, 'Ativo', 3, '546326', '2027-01-20', 'assets/acucar.png'),
  (6, '78910006', 'Farinha de Trigo Especial 1kg', 'Farinha de trigo tipo 1 para panificação profissional de alto padrão', 'Pacote', '1000g', 4.1, 6.8, 5, 8.5, 18, 40, 'Ativo', 3, '547890', '2026-11-30', 'assets/farinha.png'),
  (7, '78910007', 'Queijo Mussarela Fatiado', 'Queijo mussarela fatiado fresco para lanches e salgados', 'KG', '1000g', 32, 48, 40, 56, 6, 15, 'Ativo', 5, '549012', '2026-09-20', 'assets/queijo.png'),
  (8, '78910008', 'Leite Integral 1L', 'Leite UHT integral pasteurizado 1L', 'UN', '1000ml', 3.8, 6, 4.9, 7.5, 80, 30, 'Ativo', 2, '548900', '2026-10-15', 'assets/leite.png'),
  (9, '78910009', 'Ovos Brancos Granjeiros (Dúzia)', 'Dúzia de ovos brancos selecionados tipo grande de alta qualidade', 'DZ', '650g', 8.5, 15, 12, 18, 100, 35, 'Ativo', 3, '549111', '2026-09-25', 'assets/ovos.png'),
  (10, '78910010', 'Suco de Uva Integral 500ml', 'Suco de uva tinto 100% natural sem adição de açúcares ou conservantes', 'UN', '500ml', 4.8, 8, 6.5, 10, 25, 15, 'Ativo', 2, '578412', '2026-12-30', 'assets/suco.png'),
  (11, '78910011', 'Pão Doce Tradicional', 'Pão doce fofinho com creme de baunilha artesanal e coco ralado', 'UN', '80g', 1.1, 3.2, 2.5, 4, 60, 20, 'Ativo', 1, '548999', '2026-09-11', 'assets/pao_doce.png'),
  (12, '78910012', 'Bala Toffee Mastigável', 'Balas caramelizadas artesanais sortidas tradicionais da bomboniere', 'UN', '10g', 0.1, 0.3, 0.2, 0.5, 200, 50, 'Ativo', 4, '546111', '2027-04-10', 'assets/bala.png');

INSERT INTO requisicoes (id_requisicao, codigo_pedido, id_fornecedor, id_produto, produto_nome, quantidade_pedida, quantidade_atendida, unidade, valor_unitario, situacao, data_pedido, previsao_entrega, endereco_entrega, observacao, justificativa_cancelamento) VALUES
  (1, 'REQ-9666', 1, 2, 'Café Pilão 320g', 50, 15, 'Pacote', 12.5, 'Em Aberto', '2026-09-06', '2026-09-12', 'Padaria Nova York - Rua Visconde de Inhaúma, 450', 'Pedido prioritário de café moído para atender o fluxo matinal da padaria.', NULL),
  (2, 'REQ-9667', 3, 9, 'Ovos Brancos Granjeiros (Dúzia)', 100, 0, 'DZ', 8.5, 'Em Aberto', '2026-09-07', '2026-09-11', 'Padrão', 'Reposição semanal de ovos para a produção contínua da confeitaria.', NULL),
  (3, 'REQ-9668', 2, 6, 'Farinha de Trigo Especial 1kg', 50, 0, 'Pacote', 4.1, 'Em Aberto', '2026-09-07', '2026-09-13', 'Padrão', 'Farinha com teor protéico ideal para a fornada diária de baguetes.', NULL),
  (4, 'REQ-9669', 5, 3, 'Bolo de Cenoura', 30, 0, 'Fatia', 4.5, 'Em Aberto', '2026-09-08', '2026-09-10', 'Padrão', 'Estoque atingiu nível crítico de 4 fatias no balcão refrigerado.', NULL),
  (5, 'REQ-9670', 6, 4, 'Pão Francês', 60, 60, 'KG', 5.5, 'Finalizado', '2026-09-04', '2026-09-05', 'Padrão', 'Entregue com pontualidade e conferido integralmente pelo estoquista.', NULL),
  (6, 'REQ-9665', 8, NULL, 'Copos Descartáveis 200ml (Cento)', 20, 0, 'Pacote', 12, 'Cancelado', '2026-09-02', '2026-09-05', 'Padrão', 'Pedido cancelado após conferência do estoque remanescente no almoxarifado.', 'Cancelamento efetuado após a verificação física constatar saldo remanescente suficiente para mais 3 semanas no depósito.');

INSERT INTO vendas (id_venda, codigo_venda, data_venda, valor_total, desconto, forma_pagamento, status_venda, id_usuario) VALUES
  (1, 'VENDA-1001', '2026-09-12 10:15', 90, 0, 'Cartão Débito', 'Concluída', 2),
  (2, 'VENDA-1002', '2026-09-12 11:40', 118.4, 0, 'Dinheiro', 'Concluída', 2),
  (3, 'VENDA-1003', '2026-09-12 13:10', 120, 0, 'PIX', 'Concluída', 2),
  (4, 'VENDA-1004', '2026-09-12 14:35', 450, 0, 'Cartão Crédito', 'Concluída', 2),
  (5, 'VENDA-1005', '2026-09-12 15:05', 110, 0, 'Dinheiro', 'Concluída', 2),
  (6, 'VENDA-1006', '2026-09-12 15:25', 96, 0, 'PIX', 'Concluída', 2);

INSERT INTO itens_venda (id_venda, id_produto, quantidade, valor_unitario) VALUES
  (1, 2, 5, 18),
  (2, 11, 37, 3.2),
  (3, 8, 20, 6),
  (4, 9, 30, 15),
  (5, 4, 6.5, 16.9),
  (6, 10, 12, 8);

INSERT INTO movimentacoes (id_movimentacao, tipo_movimentacao, quantidade, data_movimentacao, observacao, id_produto, valor_unitario, id_usuario) VALUES
  (1, 'Entrada', 60, '2026-09-05 07:30', 'Recebimento de lote do fornecedor Panificadora Central', 4, 5.5, 1),
  (2, 'Saída', 15, '2026-09-07 18:20', 'Vendas acumuladas do balcão de frios e lanches', 1, 3.5, 2),
  (3, 'Saída', 6, '2026-09-08 14:10', 'Venda de Café Pilão para clientes do salão', 2, 18.9, 2);

INSERT INTO conferencias (id_conferencia, data_conferencia, id_usuario, observacao) VALUES
  (1, '2026-09-10 14:00', 2, 'Conferência de estoque físico e ajuste de saldos.');

INSERT INTO itens_conferencia (id_conferencia, id_produto, lote, quantidade_sistema, quantidade_fisica) VALUES
  (1, 5, '546326', 12, 12),
  (1, 2, '548417', 25, 25),
  (1, 4, '545846', 70, 68),
  (1, 10, '578412', 25, 25);
