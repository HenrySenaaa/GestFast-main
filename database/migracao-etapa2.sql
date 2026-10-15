-- migracao-etapa2.sql - Atualiza um banco "gestfast" já existente para a etapa 2
-- (alerta de validade e registro de perdas/sobras) SEM apagar os dados.
-- Rodar uma única vez no MySQL Workbench. Banco novo: basta o schema.sql + seed.sql.
USE gestfast;

ALTER TABLE configuracao
  ADD COLUMN dias_alerta_validade INT NOT NULL DEFAULT 3 AFTER simular_fornecedor_indisponivel;

ALTER TABLE movimentacao_estoque
  MODIFY COLUMN origem ENUM('manual','venda','requisicao','conferencia','estorno','ajuste','perda') NOT NULL DEFAULT 'manual',
  ADD COLUMN motivo_perda ENUM('Vencido','Quebra/Avaria','Sobra do dia','Outro') AFTER origem;
