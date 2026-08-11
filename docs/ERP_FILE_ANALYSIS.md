# Análise dos Arquivos do ERP — MR Força de Vendas

> **Legenda de confiança**
> - ✅ **CONFIRMADO** — verificado byte a byte no arquivo real.
> - 🟡 **INFERIDO** — interpretação coerente com os dados, mas ainda não validada com o responsável pelo ERP.
> - ❓ **DESCONHECIDO** — campo cujo significado não pode ser confirmado; valor bruto é preservado.

Toda a análise abaixo foi produzida por inspeção direta dos arquivos locais em **10/08/2026**, com scripts descartáveis executados **fora** do repositório (scratchpad). **Nenhum dado pessoal real foi copiado para este documento** — amostras aparecem redigidas (letras→`A`, dígitos→`9`) ou usam apenas dados de produto/tabela (não pessoais).

---

## 1. `dados.txt` — arquivo de atualização ERP → Força de Vendas

### 1.1 Metadados do arquivo ✅

| Propriedade | Valor verificado | Prompt dizia | Confere |
|---|---|---|---|
| Tamanho | 11.103.645 bytes (~10,6 MB) | ~11 MB | ✅ |
| Encoding | ISO-8859-1 / Latin-1 (decodifica 100%; falha em UTF-8) | Latin-1 | ✅ |
| Quebras de linha | CRLF (`\r\n`) — 109.509 ocorrências | CRLF | ✅ |
| Layout | Largura fixa por tipo de registro | Largura fixa | ✅ |
| Versão | `004.0` (header `010004.0…`) | 004.0 | ✅ |
| Data de geração | 06/08/2026 11:22 (header) | 06/08/2026 11h22 | ✅ |
| Registros lógicos | 109.454 (segmentos não vazios) | 109.454 | ✅ |
| Trailer | `99000109454###EOF###` | `99000109454###EOF###` | ✅ |
| Linhas vazias | 56 segmentos vazios | ~55 | ✅ |
| Registros quebrados | 3 (LF isolado interno em registros `10`) | 3 | ✅ |

### 1.2 Header e Trailer ✅

```
HEADER (tipo 01, 23 bytes):  010004.006/08/202611:22
                             │ │      │          └─ HH:mm  = 11:22
                             │ │      └───────────── DD/MM/AAAA = 06/08/2026
                             │ └──────────────────── versão   = 0004.0 → "004.0"
                             └────────────────────── tipo     = 01

TRAILER (tipo 99, 20 bytes): 99000109454###EOF###
                             │ │         └─ marcador fixo "###EOF###"
                             │ └─────────── total lógico = 000109454 = 109.454
                             └───────────── tipo = 99
```

O total do trailer (**109.454**) é **idêntico** à contagem de segmentos não vazios após split por CRLF. **O arquivo fecha perfeitamente.**

### 1.3 Contagem e comprimento por tipo de registro ✅

Todos os 21 tipos têm **comprimento único e constante** (nenhuma variação), e as quantidades batem **exatamente** com o prompt:

| Tipo | Bytes | Qtd (verificada) | Interpretação | Confiança |
|---|---:|---:|---|---|
| 01 | 23 | 1 | Cabeçalho (versão, data, hora) | ✅ |
| 05 | 47 | 122 | Representantes / vendedores | ✅ |
| 06 | 56 | 1 | Empresa | 🟡 |
| 10 | 432 | 4.926 | Clientes e carteira | ✅ |
| 12 | 49 | 4.926 | Resumo financeiro / crédito | 🟡 |
| 15 | 132 | 4.600 | Títulos e parcelas | 🟡 |
| 22 | 105 | 946 | Catálogo comercial de produtos | ✅ |
| 27 | 26 | 4.960 | Estoque por produto | ✅ |
| 28 | 62 | 19.854 | Preços por tabela × produto | ✅ |
| 30 | 38 | 6 | Tabelas de preço | ✅ |
| 40 | 33 | 6 | Segmentos | ✅ |
| 41 | 44 | 17 | Informações de cobrança | 🟡 |
| 42 | 33 | 577 | Condições de pagamento | 🟡 |
| 43 | 23 | 56 | Tipos/formas de cobrança | ✅ |
| 44 | 29 | 325 | Grupos de produto | ✅ |
| 45 | 29 | 16 | Tipos adicionais de produto | ✅ |
| 47 | 53 | 646 | Cidades | 🟡 |
| 62 | 71 | 577 | Detalhes das condições de pagamento | 🟡 |
| 80 | 117 | 2.113 | Cabeçalhos de pedidos/movimentações | 🟡 |
| 82 | 94 | 64.778 | Itens dos pedidos/movimentações | 🟡 |
| 99 | 20 | 1 | Fechamento do arquivo | ✅ |

**Soma dos tipos = 109.454 = total do trailer.** ✅

### 1.4 O mecanismo dos "3 registros quebrados" ✅ (esclarecido)

O arquivo tem exatamente **3 bytes LF isolados** (`0x0A` **sem** `0x0D` antes), todos **dentro** de registros do tipo `10` (cliente), no campo de razão social / nome fantasia.

- O separador oficial de registro é **CRLF**. Ao dividir por `\r\n`, esses 3 LFs internos **não** quebram o registro — ele permanece com 432 bytes íntegros (o LF conta como 1 dos 432).
- **Porém**, um parser ingênuo que divida por **qualquer `\n`** (comportamento de `readline`/`split('\n')` padrão) transforma 109.454 registros em **109.457** e corrompe 3 registros do tipo 10.

**Prova executada:**
```
segmentos split-by-CRLF (correto): 109.454
segmentos split-by-LF   (ingênuo): 109.457
diferença (registros corrompidos por um LF-splitter): 3
```

**Regra do parser:** dividir **exclusivamente por CRLF** e, ao encontrar um `\n` isolado dentro de um campo, **normalizá-lo para espaço** (item 7 do prompt). Isso recupera o comprimento esperado e preserva o texto.

---

## 2. Layouts confirmados dos registros de produto (não sensíveis)

Registros de produto/tabela **não contêm dados pessoais** e puderam ser mapeados diretamente.
Um marcador literal `***` aparece nos offsets 2–4 de todos os registros de produto/estrutura (22, 27, 28, 30, 40, 43, 44, 45). 🟡 Interpretado como marcador de sub-registro/filial-agnóstico.

### 2.1 Tipo 22 — Catálogo comercial (105 bytes) ✅

```
Offset  Tam  Campo                       Confiança  Exemplo
------  ---  --------------------------  ---------  -----------------------------
0-1      2   Tipo de registro ("22")     ✅
2-4      3   Marcador "***"              🟡
5-10     6   Código do produto           ✅         000080
11-50   40   Descrição — parte 1         ✅         "DS 06 PINCEL LABIAL DAILUS"
51-54    4   Código do GRUPO (→ tipo 44) ✅         0043   (946/946 válidos no tipo 44)
55-74   20   Descrição — parte 2         ✅         continuação da descrição
75-76    2   Unidade                     ✅         "Un"/"UN"/"PC"/"CX"/"DP"
77-100  24   Bloco numérico + flags      ❓         "00.0000001.0000002..."
101-104  4   Ref. tipo adicional (→ 45)  🟡         0008 (471/946 casam com tipo 45)
```

> **⚠️ Nuance crítica da descrição:** a descrição é dividida em **duas partes não contíguas** — a parte 1 (11–50) e a parte 2 (55–74) são separadas pelo **código de grupo (51–54)**. A reconstrução correta é `descrição = (parte1 + parte2).trim()`, **pulando** o grupo do meio.
> Exemplo real: parte1 `"…- TOBOGA DE ARCO I"` + parte2 `"RIS"` → `"…- TOBOGA DE ARCO IRIS"`.

### 2.2 Tipo 27 — Estoque (26 bytes) ✅

```
0-1     Tipo "27"
2-4     "***"
5-10    Código de filial/empresa  (constante 000001 em todos os 4.960)
11-16   Código do produto
17-25   Quantidade em estoque  (formato NNNNN.NNN; sinal "-" embutido p/ negativos)
```
Exemplo negativo: `27***000001001012000-1.000` → produto 001012, estoque **−1,000**.

**Distribuição de estoque verificada:**
- Universo total (4.960 códigos): 411 positivos · 4.381 zerados · 168 negativos.
- **Apenas produtos do catálogo (946): 393 positivos · 397 zerados · 156 negativos** → soma 946. ✅ (bate com o prompt seção 22)

### 2.3 Tipo 28 — Preços por tabela × produto (62 bytes) ✅

```
0-1     Tipo "28"
2-4     "***"
5-7     Código da tabela de preço  (3 dígitos)
8-13    Código do produto
14-21   Valor 1  (NNNN.NNN)  ← frequentemente 0000.000
22-29   Valor 2
30-37   Valor 3
38-45   Valor 4
46-53   Valor 5
54-61   Valor 6
```
Seis valores por registro. **O mapeamento "Valor N → Preço 1/Preço 2 do HTML" NÃO está confirmado** (ver OPEN_QUESTIONS). Os seis valores são preservados brutos.

### 2.4 Tipo 30 — Tabelas de preço (38 bytes) ✅

```
0-1 "30" | 2-4 "***" | 5-7 código (3 díg) | 8-37 rótulo
```
Tabelas encontradas (idênticas ao prompt):

| Código | Rótulo |
|---|---|
| 002 | MR |
| 012 | SN - SIMPLES NACIONAL |
| 033 | LCRP - LUCRO REAL/PRESUMIDO |
| 053 | MELINDA - LCRP |
| 055 | SM - LUCRO REAL/PRESUMIDO |
| 061 | SM - SIMPLES NACIONAL |

**Cobertura por tabela no tipo 28** (nº de produtos precificados): 002=4.056 · 012=3.944 · 033=3.944 · 053=2.377 · 055=1.589 · 061=3.944 → intervalo **1.589–4.056**, exatamente como o prompt. ✅

### 2.5 Tipo 40 — Segmentos (33 bytes) ✅

`40***` + código(3) + rótulo. Valores: 001 PERFUMARIA · 002 FARMACIA · 003 OUTROS · 004 ALIMENTAR · 005 DISTRIBUIDOR · 006 E-COMERCE.

### 2.6 Tipo 44 — Grupos de produto (29 bytes) ✅

`44***` + código(4) + rótulo(20). 325 grupos (0001…). 100% dos grupos referenciados pelo tipo 22 existem aqui.

### 2.7 Tipo 45 — Tipos adicionais (29 bytes) ✅

`45***` + código(4) + rótulo(20). 16 entradas (ESMALTE DAILUS, PELE, LABIOS, OLHOS, etc.).

### 2.8 Tipo 43 — Formas de cobrança (23 bytes) ✅

`43***` + código(3) + rótulo(15, truncado). Vários rótulos começam com `Z*`/`Z ` (🟡 convenção de "inativo").

### 2.9 Tipo 05 — Representantes (47 bytes) ✅ (estrutura; nomes não impressos)

`05` + código(6) + nome + valor final (NNNNN.NN). 122 registros, 122 códigos distintos. Alguns rótulos indicam inativos (`Z*`, `[INATIVO]`). **O prompt exige que estes NÃO gerem usuários automaticamente.**

---

## 3. Layouts de registros com dados pessoais (estrutura sem PII)

### 3.1 Tipo 10 — Clientes / carteira (432 bytes) ✅ estrutura de chaveamento

Apenas a estrutura de **chaveamento** foi verificada (sem imprimir conteúdo real):

```
0-1     Tipo "10"
2-4     Código do REPRESENTANTE (3 díg)   → 87 valores distintos entre clientes
5-10    Código do CLIENTE (6 díg)         → 4.910 distintos (de 4.926 registros)
...     Razão social, nome fantasia, doc, IE, endereço, número, complemento,
        bairro, CEP, cidade, UF, telefones, contato, segmento, forma de cobrança,
        limite, código da tabela de preço  (offsets exatos: ver DATA_DICTIONARY 🟡)
```

Isto confirma o relacionamento de **carteira**: `representante (3 díg) → clientes`. Os 3 registros com LF interno estão neste tipo (campo de nome). Os offsets internos detalhados dos demais campos estão marcados 🟡 no dicionário e serão refinados com amostras sintéticas — **não** foram fixados a partir de PII real.

### 3.2 Tipos 12, 15, 41, 42, 47, 62 🟡

Estrutura de comprimento confirmada; semântica de campos internos ainda 🟡/❓ (financeiro, títulos, cidades, condições de pagamento). Preservados brutos no staging até validação.

### 3.3 Tipos 80 / 82 — Pedidos/movimentações 🟡

`80` (cabeçalho, 117B) e `82` (item, 94B). Contêm datas (emissão/segunda data), valores e códigos. **O prompt determina não usar interpretações não confirmadas em regras críticas.** São preservados brutos; **não** alimentam o motor de pedidos novo.

---

## 4. `GGGGGGGGGGG.html` — Romaneio FastReport (fonte complementar)

### 4.1 Metadados ✅

| Propriedade | Verificado | Prompt | Confere |
|---|---|---|---|
| Gerador | FastReport 5.0 | FastReport 5.0 | ✅ |
| Encoding | UTF-8 | — | ✅ |
| Carga | 9584 | 9584 | ✅ |
| Páginas | 26 (`page_break`) | 26 | ✅ |
| Pedidos | 17 (labels Representante/Transportadora/Tabela/Volume = 17 cada) | 17 | ✅ |
| Linhas de produto | 634 (tokens EAN) | 634 | ✅ |
| Produtos únicos | 261 (EANs distintos) | 261 | ✅ |
| Data de faturamento | ausente em todos | ausente | ✅ |
| Total R$ 50.786,76 | 🟡 não localizado como célula única (provável agregação não impressa) | ~50.786,76 | 🟡 |

### 4.2 Relação de enriquecimento extraível ✅

Do HTML extrai-se **somente** `código do produto → EAN → descrição` (261 linhas únicas). Validação cruzada bem-sucedida: HTML código `1902` → produto `001902` no `dados.txt` = "006 ESMALTE ARCO IRIS - CHIFRE MAGICO". Os códigos do HTML são a forma **sem zeros à esquerda** dos códigos de 6 dígitos do `dados.txt`.

> **Regra:** o HTML é **fonte complementar de enriquecimento**, não sincronização operacional. Importar **apenas** produto→EAN→descrição, com origem `erp_fastreport_html`. **Nunca** importar clientes, CNPJ, pedidos ou financeiro do HTML.

### 4.3 `EEEEEEEEEEE.pdf` e `FFFFFFFFFFFFF.xls`

Mesmo romaneio em outros formatos (exemplo de pedido). Tratados como o HTML: referência/diagnóstico, **não** entrada operacional. Ignorados no Git.

---

## 5. Conclusões para o design do sistema

1. O `dados.txt` v004.0 é **íntegro e determinístico** — parser de largura fixa é viável e testável.
2. A validação de importação deve exigir: header válido, trailer `###EOF###`, e **contagem lógica == trailer**, senão **rejeitar tudo** (nunca publicação parcial).
3. Catálogo comercial = **tipo 22 (946 produtos)**. Estoque (4.960) e preços (4.069) contêm códigos históricos/inativos que **não** entram no catálogo automaticamente (ver Diagnóstico do Catálogo).
4. Os **6 valores** do tipo 28 exigem mapeamento administrativo de nível de preço — **não** presumir Preço 1/2 silenciosamente.
5. Campos ❓ (tail do tipo 22, internos de 12/15/80/82) são preservados brutos e listados em `OPEN_QUESTIONS.md`.
