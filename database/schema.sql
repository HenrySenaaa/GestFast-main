-- GestFast ERP - esquema relacional de referência (MySQL 8 / MariaDB 10.5+)
-- Reflete o modelo de dados implementado em db.js (hoje persistido em data/gestfast.json).
-- Serve de base para uma futura migração para banco relacional.
CREATE DATABASE IF NOT EXISTS gestfast CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestfast;

CREATE TABLE perfil (
  id_perfil INT PRIMARY KEY AUTO_INCREMENT,
  nome_perfil VARCHAR(30) NOT NULL UNIQUE            -- Administrador, BackOffice, Funcionario
);

CREATE TABLE usuario (
  id_usuario INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,                -- login
  senha VARCHAR(255) NOT NULL,                       -- hash scrypt (nunca texto puro)
  cargo VARCHAR(100),
  status ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  data_criacao DATE NOT NULL,
  id_perfil INT NOT NULL,
  FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil)
);

CREATE TABLE categoria (
  id_categoria INT PRIMARY KEY AUTO_INCREMENT,
  nome_categoria VARCHAR(100) NOT NULL UNIQUE,
  descricao VARCHAR(255)
);

CREATE TABLE fornecedor (
  id_fornecedor INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE produto (
  id_produto INT PRIMARY KEY AUTO_INCREMENT,
  codigo_barras VARCHAR(100) NOT NULL UNIQUE,
  nome_produto VARCHAR(200) NOT NULL,
  descricao TEXT,
  unidade VARCHAR(20) NOT NULL DEFAULT 'UN',         -- KG e Lt aceitam fração; as demais só inteiros
  peso VARCHAR(30),
  preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(10,2) NOT NULL,
  preco_min DECIMAL(10,2) NOT NULL,
  preco_max DECIMAL(10,2) NOT NULL,
  quantidade_estoque DECIMAL(12,3) NOT NULL DEFAULT 0,
  estoque_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  lote VARCHAR(40),
  validade DATE,
  imagem VARCHAR(255),
  status ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  id_categoria INT NOT NULL,
  FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria),
  CHECK (preco_venda > 0),
  CHECK (preco_min <= preco_venda AND preco_venda <= preco_max)
);

CREATE TABLE requisicao (
  id_requisicao INT PRIMARY KEY AUTO_INCREMENT,
  codigo_pedido VARCHAR(20) NOT NULL UNIQUE,
  id_fornecedor INT NOT NULL,
  id_produto INT NULL,
  produto_nome VARCHAR(200) NOT NULL,
  quantidade_pedida DECIMAL(12,3) NOT NULL,
  quantidade_atendida DECIMAL(12,3) NOT NULL DEFAULT 0,
  unidade VARCHAR(20) NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(12,2) NOT NULL,
  situacao ENUM('Em Aberto','Cotado','AF Gerada','Finalizado','Cancelado') NOT NULL DEFAULT 'Em Aberto',
  data_pedido DATE NOT NULL,
  previsao_entrega DATE,
  endereco_entrega VARCHAR(255),
  observacao TEXT,
  justificativa_cancelamento TEXT,
  FOREIGN KEY (id_fornecedor) REFERENCES fornecedor(id_fornecedor),
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

CREATE TABLE requisicao_historico (
  id_historico INT PRIMARY KEY AUTO_INCREMENT,
  id_requisicao INT NOT NULL,
  data_registro DATETIME NOT NULL,
  situacao VARCHAR(60) NOT NULL,
  id_usuario INT,
  FOREIGN KEY (id_requisicao) REFERENCES requisicao(id_requisicao),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE movimentacao_estoque (
  id_movimentacao INT PRIMARY KEY AUTO_INCREMENT,
  tipo_movimentacao ENUM('Entrada','Saída') NOT NULL,
  quantidade DECIMAL(12,3) NOT NULL CHECK (quantidade > 0),
  data_movimentacao DATETIME NOT NULL,
  observacao TEXT,
  origem ENUM('manual','venda','requisicao','conferencia','estorno','ajuste') NOT NULL DEFAULT 'manual',
  valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  id_produto INT NOT NULL,
  id_usuario INT,
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto),
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE venda (
  id_venda INT PRIMARY KEY AUTO_INCREMENT,
  codigo_venda VARCHAR(20) NOT NULL UNIQUE,
  data_venda DATETIME NOT NULL,
  valor_subtotal DECIMAL(12,2) NOT NULL,
  desconto DECIMAL(12,2) NOT NULL DEFAULT 0,
  desconto_tipo ENUM('valor','percentual') NOT NULL DEFAULT 'valor',
  valor_total DECIMAL(12,2) NOT NULL,
  forma_pagamento ENUM('Dinheiro','Cartão Débito','Cartão Crédito','PIX') NOT NULL,
  valor_recebido DECIMAL(12,2),
  troco DECIMAL(12,2),
  nsu VARCHAR(20),
  status_venda ENUM('Concluída','Cancelada') NOT NULL DEFAULT 'Concluída',
  motivo_cancelamento TEXT,
  data_cancelamento DATETIME,
  autorizada_por INT,
  id_usuario INT NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
  FOREIGN KEY (autorizada_por) REFERENCES usuario(id_usuario)
);

CREATE TABLE item_venda (
  id_item_venda INT PRIMARY KEY AUTO_INCREMENT,
  id_venda INT NOT NULL,
  id_produto INT NOT NULL,
  quantidade DECIMAL(12,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (id_venda) REFERENCES venda(id_venda) ON DELETE CASCADE,
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

CREATE TABLE conferencia (
  id_conferencia INT PRIMARY KEY AUTO_INCREMENT,
  data_conferencia DATETIME NOT NULL,
  observacao VARCHAR(1000),
  ajustou_estoque BOOLEAN NOT NULL DEFAULT TRUE,
  id_usuario INT NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE item_conferencia (
  id_item_conferencia INT PRIMARY KEY AUTO_INCREMENT,
  id_conferencia INT NOT NULL,
  id_produto INT NOT NULL,
  quantidade_sistema DECIMAL(12,3) NOT NULL,
  quantidade_fisica DECIMAL(12,3) NOT NULL,
  divergencia DECIMAL(12,3) NOT NULL,
  FOREIGN KEY (id_conferencia) REFERENCES conferencia(id_conferencia) ON DELETE CASCADE,
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

CREATE TABLE alerta_estoque (
  id_alerta INT PRIMARY KEY AUTO_INCREMENT,
  data_alerta DATETIME NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  status_alerta ENUM('Ativo','Resolvido') NOT NULL DEFAULT 'Ativo',
  id_produto INT NOT NULL,
  FOREIGN KEY (id_produto) REFERENCES produto(id_produto)
);

CREATE TABLE relatorio (
  id_relatorio INT PRIMARY KEY AUTO_INCREMENT,
  tipo_relatorio VARCHAR(60) NOT NULL,
  data_geracao DATETIME NOT NULL,
  id_usuario INT NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE INDEX idx_venda_data ON venda(data_venda);
CREATE INDEX idx_mov_produto_data ON movimentacao_estoque(id_produto, data_movimentacao);
CREATE INDEX idx_produto_status ON produto(status, id_categoria);
