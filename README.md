# GestFast ERP

Sistema de gestão de estoque e vendas para panificadoras (projeto USCS - ADS). Back-end em Node.js **sem dependências externas** e front-end em HTML/CSS/JS puro.

## Como executar

```bash
node server.js          # http://localhost:3000   (Node 18 ou superior)
npm test                # 16 testes automatizados da API (cenários do Apêndice F)
```

Variáveis opcionais: `PORT`, `TZ` (padrão `America/Sao_Paulo`), `GESTFAST_DATA` (arquivo de dados) e `GESTFAST_LOG_DIR`.

No primeiro acesso são criados dados de exemplo em `data/gestfast.json`. Para recomeçar do zero, apague a pasta `data/`.

## Usuários iniciais (altere as senhas em Funcionários / Configuração)

| Perfil | Login | Senha inicial |
|---|---|---|
| Administrador | proprietario@padarianovayork.com | admin123 |
| BackOffice | backoffice@padarianovayork.com | backoffice123 |
| Funcionário | henry@padarianovayork.com | func123 |

## O que o sistema faz

| Área | Recursos |
|---|---|
| Login | senha com hash scrypt, "manter conectado", conta inativa bloqueada, bloqueio temporário após 5 falhas, recuperação de senha por link (o link é escrito no console/log, pois não há SMTP) |
| Perfis | Administrador, BackOffice e Funcionário, validados no servidor e refletidos no menu |
| Painel | alertas de estoque mínimo (clique no item para criar a requisição), compras recentes, gráfico, atualização automática |
| Busca | a barra do topo acha telas e também produtos, requisições, vendas e funcionários (conforme o perfil); atalhos `/` e `Ctrl+K` |
| Produtos | incluir, alterar, inativar/reativar, filtro por categoria/situação, upload de imagem, validações de preço, código único |
| Estoque | conferência física com divergência, ajuste automático e histórico; alerta de validade |
| Requisições | criar, cotar, gerar AF, receber (total ou parcial, com entrada automática no estoque), cancelar com justificativa, histórico |
| Entradas / Saídas | individual ou **em lote**, com filtro por período |
| Caixa (PDV) | busca por código de barras, desconto em R$ ou %, limite de desconto configurável, troco, baixa automática de estoque |
| Histórico de vendas | consultar, editar quantidades, cancelar (exige senha de gerente, estorna estoque) e excluir (só Administrador) |
| Relatórios | faturamento/vendas e estoque (entradas, saídas, saldo) com filtro de período e categoria; exportação real em **PDF** e **Excel (.xlsx)** |
| Funcionários | cadastrar, alterar, trocar perfil, ativar/desativar, filtros |
| Configuração | parâmetros, troca de senha, acessibilidade (texto A-/A+, alto contraste), logs de atividade |

## Regras importantes

- Produtos em **UN, Pacote, DZ e Fatia só aceitam quantidades inteiras**; apenas **KG e Lt** aceitam frações (validado no navegador e no servidor).
- Toda operação que altera estoque é uma transação: se algo falhar, nada é gravado.
- Falhas externas (operadora de cartão negando, fornecedor fora do ar) podem ser simuladas em Configuração para demonstração.

## Estrutura

```
server.js            API REST, autenticação, rotas e arquivos estáticos
db.js                regras de negócio, validações e persistência (JSON atômico)
lib/                 auth (scrypt), permissões, logger, exportação PDF/XLSX, gateways simulados
public/              interface (index.html, style.css, js/ por módulo)
database/schema.sql  esquema relacional de referência (MySQL) para migração futura
test/api.test.js     testes automatizados
```
