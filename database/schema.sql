-- =====================================================================
-- GestFast ERP — Estrutura do banco de dados (MySQL 8)
-- Baseado no banco simulado em memória (db.js).
-- Como usar: abrir no MySQL Workbench e executar o arquivo inteiro (raio ⚡).
-- Depois executar seed.sql para carregar os dados de exemplo.
-- ATENÇÃO: o DROP DATABASE abaixo apaga o banco gestfast se ele já existir.
-- =====================================================================

DROP DATABASE IF EXISTS gestfast;
CREATE DATABASE gestfast
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE gestfast;

-- ---------------------------------------------------------------------
-- Usuários e perfis de acesso
-- ---------------------------------------------------------------------
CREATE TABLE perfis (
  id_perfil    INT AUTO_INCREMENT PRIMARY KEY,
  nome_perfil  VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id_usuario    INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  senha_hash    VARCHAR(255) NULL,          -- preenchido na etapa de login (nov/2026), nunca senha em texto puro
  cargo         VARCHAR(100),
  status        ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  data_criacao  DATE NOT NULL DEFAULT (CURRENT_DATE),
  id_perfil     INT NOT NULL,
  CONSTRAINT fk_usuarios_perfil FOREIGN KEY (id_perfil) REFERENCES perfis (id_perfil)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id_categoria    INT AUTO_INCREMENT PRIMARY KEY,
  nome_categoria  VARCHAR(80) NOT NULL UNIQUE,
  descricao       VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE fornecedores (
  id_fornecedor  INT AUTO_INCREMENT PRIMARY KEY,
  nome           VARCHAR(150) NOT NULL UNIQUE,
  cnpj           CHAR(14) NULL,
  telefone       VARCHAR(20) NULL,
  email          VARCHAR(150) NULL
) ENGINE=InnoDB;

CREATE TABLE produtos (
  id_produto          INT AUTO_INCREMENT PRIMARY KEY,
  codigo_barras       VARCHAR(20) NOT NULL UNIQUE,
  nome_produto        VARCHAR(150) NOT NULL,
  descricao           TEXT,
  unidade             ENUM('UN','KG','DZ','Pacote','Fatia','Lt') NOT NULL DEFAULT 'UN',
  peso                VARCHAR(20),
  preco_custo         DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_venda         DECIMAL(10,2) NOT NULL,
  preco_min           DECIMAL(10,2),
  preco_max           DECIMAL(10,2),
  quantidade_estoque  DECIMAL(10,3) NOT NULL DEFAULT 0,   -- 3 casas para itens vendidos em KG
  estoque_minimo      DECIMAL(10,3) NOT NULL DEFAULT 10,
  status              ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  id_categoria        INT NOT NULL,
  lote                VARCHAR(30),
  validade            DATE,
  imagem              VARCHAR(255),
  CONSTRAINT fk_produtos_categoria FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria),
  CONSTRAINT ck_produtos_preco CHECK (preco_venda > 0),
  CONSTRAINT ck_produtos_estoque CHECK (quantidade_estoque >= 0),
  INDEX idx_produtos_nome (nome_produto),
  INDEX idx_produtos_validade (validade)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Compras (requisições a fornecedores)
-- ---------------------------------------------------------------------
CREATE TABLE requisicoes (
  id_requisicao               INT AUTO_INCREMENT PRIMARY KEY,
  codigo_pedido               VARCHAR(20) NOT NULL UNIQUE,
  id_fornecedor               INT NOT NULL,
  id_produto                  INT NULL,               -- pode ser item ainda não cadastrado
  produto_nome                VARCHAR(150) NOT NULL,
  quantidade_pedida           DECIMAL(10,3) NOT NULL,
  quantidade_atendida         DECIMAL(10,3) NOT NULL DEFAULT 0,
  unidade                     VARCHAR(10) NOT NULL DEFAULT 'UN',
  valor_unitario              DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_total                 DECIMAL(12,2) GENERATED ALWAYS AS (quantidade_pedida * valor_unitario) STORED,
  situacao                    ENUM('Em Aberto','Finalizado','Cancelado') NOT NULL DEFAULT 'Em Aberto',
  data_pedido                 DATE NOT NULL DEFAULT (CURRENT_DATE),
  previsao_entrega            DATE,
  endereco_entrega            VARCHAR(255),
  observacao                  TEXT,
  justificativa_cancelamento  TEXT,
  CONSTRAINT fk_requisicoes_fornecedor FOREIGN KEY (id_fornecedor) REFERENCES fornecedores (id_fornecedor),
  CONSTRAINT fk_requisicoes_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto),
  CONSTRAINT ck_requisicoes_qtd CHECK (quantidade_pedida > 0),
  INDEX idx_requisicoes_situacao (situacao)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vendas (PDV / balcão)
-- ---------------------------------------------------------------------
CREATE TABLE vendas (
  id_venda         INT AUTO_INCREMENT PRIMARY KEY,
  codigo_venda     VARCHAR(20) NOT NULL UNIQUE,
  data_venda       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_total      DECIMAL(12,2) NOT NULL,
  desconto         DECIMAL(10,2) NOT NULL DEFAULT 0,
  forma_pagamento  ENUM('Dinheiro','PIX','Cartão Débito','Cartão Crédito') NOT NULL DEFAULT 'Dinheiro',
  status_venda     ENUM('Concluída','Cancelada') NOT NULL DEFAULT 'Concluída',
  id_usuario       INT NOT NULL,
  CONSTRAINT fk_vendas_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  INDEX idx_vendas_data (data_venda)
) ENGINE=InnoDB;

CREATE TABLE itens_venda (
  id_item_venda   INT AUTO_INCREMENT PRIMARY KEY,
  id_venda        INT NOT NULL,
  id_produto      INT NOT NULL,
  quantidade      DECIMAL(10,3) NOT NULL,
  valor_unitario  DECIMAL(10,2) NOT NULL,             -- preço praticado no momento da venda
  subtotal        DECIMAL(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  CONSTRAINT fk_itens_venda_venda FOREIGN KEY (id_venda) REFERENCES vendas (id_venda) ON DELETE CASCADE,
  CONSTRAINT fk_itens_venda_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto),
  CONSTRAINT ck_itens_venda_qtd CHECK (quantidade > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Movimentações de estoque (histórico de toda entrada e saída)
-- ---------------------------------------------------------------------
CREATE TABLE movimentacoes (
  id_movimentacao    INT AUTO_INCREMENT PRIMARY KEY,
  tipo_movimentacao  ENUM('Entrada','Saída') NOT NULL,
  quantidade         DECIMAL(10,3) NOT NULL,
  data_movimentacao  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacao         TEXT,
  id_produto         INT NOT NULL,
  valor_unitario     DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_total        DECIMAL(12,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  id_usuario         INT NOT NULL,
  id_venda           INT NULL,                        -- preenchido quando a origem é uma venda
  id_requisicao      INT NULL,                        -- preenchido quando a origem é uma requisição
  CONSTRAINT fk_mov_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto),
  CONSTRAINT fk_mov_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
  CONSTRAINT fk_mov_venda FOREIGN KEY (id_venda) REFERENCES vendas (id_venda),
  CONSTRAINT fk_mov_requisicao FOREIGN KEY (id_requisicao) REFERENCES requisicoes (id_requisicao),
  CONSTRAINT ck_mov_qtd CHECK (quantidade > 0),
  INDEX idx_mov_data (data_movimentacao),
  INDEX idx_mov_tipo (tipo_movimentacao)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Conferência de inventário (físico x sistema)
-- ---------------------------------------------------------------------
CREATE TABLE conferencias (
  id_conferencia    INT AUTO_INCREMENT PRIMARY KEY,
  data_conferencia  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario        INT NOT NULL,                     -- responsável pela contagem
  observacao        TEXT,
  CONSTRAINT fk_conf_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE itens_conferencia (
  id_item_conferencia  INT AUTO_INCREMENT PRIMARY KEY,
  id_conferencia       INT NOT NULL,
  id_produto           INT NOT NULL,
  lote                 VARCHAR(30),
  quantidade_sistema   DECIMAL(10,3) NOT NULL,
  quantidade_fisica    DECIMAL(10,3) NOT NULL,
  divergencia          DECIMAL(10,3) GENERATED ALWAYS AS (quantidade_fisica - quantidade_sistema) STORED,
  estoque_ajustado     BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_itens_conf_conf FOREIGN KEY (id_conferencia) REFERENCES conferencias (id_conferencia) ON DELETE CASCADE,
  CONSTRAINT fk_itens_conf_produto FOREIGN KEY (id_produto) REFERENCES produtos (id_produto)
) ENGINE=InnoDB;
