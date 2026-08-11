# Importação do ERP → Supabase (dados reais)

Este módulo lê o arquivo `dados.txt` do ERP (layout largura-fixa v004.0, Latin-1,
CRLF) e popula o Supabase com **vendedores, clientes, produtos, grupos, tabelas de
preço, preços, estoque** e o **diagnóstico do catálogo**.

> **Segurança.** Dados reais vão **somente** para o seu Supabase (privado). O arquivo
> bruto e a `service_role` key **nunca** entram no Git (protegidos no `.gitignore`).
> Este repositório é público — não comite `dados.txt` nem segredos.

## Parser `dados-v4` (o que ele garante)
- Decodifica Latin-1, divide por CRLF, ignora linhas vazias.
- Reconstrói registros quebrados (normaliza quebra interna → espaço).
- Valida tipo/comprimento de cada registro, cabeçalho (01) e trailer (99 `###EOF###`).
- Reconcilia a contagem lógica com o trailer e **rejeita o arquivo inteiro** se algo
  estiver inválido (nunca importação parcial). Relatório **sanitizado** (sem PII).

Verificado no arquivo real: **109.454 registros = trailer**, catálogo **946**
(393 positivo / 397 zero / 156 negativo), 4.926 clientes, 141 vendedores.

## Como importar

1. **Instale as dependências** (adicionamos `tsx`):
   ```bash
   npm install
   ```
2. **Configure o segredo** — a `SUPABASE_URL` já vem do `.env`. Adicione a
   **service_role key** do seu projeto Supabase em um arquivo `.env.local`
   (ignorado pelo Git):
   ```bash
   echo 'SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE' > .env.local
   ```
   (Pegue em: Supabase → Project Settings → API → `service_role` secret.)
3. **Valide primeiro sem gravar** (dry-run):
   ```bash
   npm run import:erp -- "/caminho/para/dados.txt" --dry-run
   ```
   Mostra contagens e uma amostra sanitizada (CNPJ mascarado).
4. **Importe de verdade**:
   ```bash
   npm run import:erp -- "/caminho/para/dados.txt"
   ```
   Opcional: passe também o romaneio HTML para carregar os EANs:
   ```bash
   npm run import:erp -- "/caminho/dados.txt" "/caminho/romaneio.html"
   ```

O upsert é **idempotente** (pode rodar de novo com um arquivo novo do ERP); registros
que somem numa nova carga **não são apagados**. Cada execução cria um `erp_import_runs`.

## Análise local (sem banco)
```bash
npm run analyze:erp -- "/caminho/para/dados.txt"
```

## Campos e confiança
Códigos, descrições, grupos, unidade, estoque e preços são **confirmados**. Os campos
internos do cliente (razão social, nome fantasia, CNPJ, cidade, UF, tabela) foram
**decodificados por análise de layout** e conferem na amostra, mas seguem marcados como
🟡 até validação com o responsável pelo ERP (ver `docs/OPEN_QUESTIONS.md`). O **limite
de crédito** e o **mapeamento do nível de preço** (qual dos 6 valores) permanecem
pendentes de confirmação (Q1/Q6) — o limite entra conservador e o nível usa a
configuração provisória por tabela.
