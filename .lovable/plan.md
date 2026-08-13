# Limite de crédito: trazer o valor real do ERP e liberar quando não houver

## O que está acontecendo hoje

A regra "Limite de crédito excedido" compara `saldo em aberto + total do pedido` com o limite do cliente. Hoje **todos os 4.910 clientes estão com limite 0 e saldo 0** no banco, então qualquer pedido acima de R$ 0 dispara a exceção e exige aprovação do Administrador.

O importador até tenta ler o limite: ele procura um número no formato `999999999.99` num trecho fixo da linha do cliente (posições 330–349) e grava 0 quando não encontra. Na base atual nenhum cliente ficou com valor, o que indica que a posição está errada ou que o arquivo não traz esse campo.

## O que será feito

### 1. Investigar o arquivo do ERP
- Analisar as linhas de cliente (tipo 10) do `dados.txt` procurando, em toda a linha, campos numéricos que pareçam limite de crédito e saldo em aberto.
- Se um campo consistente for encontrado, corrigir a posição/regex no leitor e passar a gravar limite e saldo reais no cadastro do cliente a cada importação.
- Se não existir esse dado no arquivo, registrar isso na documentação de importação e manter o valor como "não informado".

### 2. Liberar quando o limite não for informado
- A regra passa a rodar **somente para clientes com limite maior que zero**. Limite 0/nulo = "não informado" e o pedido segue direto, sem cair em aprovação por crédito.
- O texto da exceção passa a mostrar os valores envolvidos (limite, saldo em aberto e total), para o aprovador entender o motivo.

### 3. Exibição
- Na ficha do cliente e no cadastro administrativo, limite 0 aparece como "Não informado" em vez de "R$ 0,00", e o crédito disponível deixa de aparecer nesse caso.
- O administrador continua podendo cadastrar o limite manualmente na edição do cliente; a partir daí a regra volta a valer para aquele cliente.

## Detalhes técnicos

- `src/lib/erp/parser/records.ts`: revisar `CREDIT_LIMIT_RE` e a janela `line.slice(330, 349)`; incluir extração de saldo em aberto se o campo existir.
- `src/lib/erp/import.server.ts`: gravar `credit_limit`/`open_balance` reais; não sobrescrever com 0 um limite já ajustado manualmente quando o arquivo não trouxer o valor.
- `src/lib/orders/validation.ts`: condicionar a exceção `credit_limit_exceeded` a `creditLimit > 0` e enriquecer o `detail` com os valores.
- `src/components/admin/customer-detail-dialog.tsx`: tratar limite não informado na exibição.
- Nenhuma mudança de schema é necessária (as colunas `credit_limit` e `open_balance` já existem).
