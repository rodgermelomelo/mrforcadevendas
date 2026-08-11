# Perguntas em Aberto — para o responsável técnico pelo ERP

> Cada item lista: **o que sabemos**, **o que falta confirmar** e **como o sistema se comporta enquanto não há confirmação** (nunca bloqueia o desenvolvimento; nunca assume silenciosamente).

## 🔴 Bloqueadores de regra crítica (exigem confirmação antes de ir a produção)

### Q1. Mapeamento dos 6 valores do tipo 28 → nível de preço
- **Sabemos:** cada registro `28` (tabela × produto) tem 6 valores (`value_1..value_6`). O 1º costuma ser `0000.000`. O HTML cita "Preço 1"/"Preço 2".
- **Falta:** qual dos 6 valores corresponde a cada nível de preço comercial, por tabela? Há relação com tributação (SN vs LCRP)?
- **Comportamento atual:** guardamos os 6 valores brutos. Existe `price_level_mappings` (config admin). **Se a tabela aplicável não tiver mapeamento, a geração de pedido é BLOQUEADA** com aviso "configuração de preço pendente". Nenhum preço é exibido sem tabela+nível definidos.

### Q2. Contrato de saída Força de Vendas → ERP
- **Sabemos:** o ERP é a fonte oficial; recebe apenas pedidos finais confirmados. O HTML é relatório **pós**-entrada (não revela o payload de importação).
- **Falta:** formato exato (API? TXT largura fixa? CSV/XLSX? SFTP? pasta monitorada?), campos obrigatórios, chave de idempotência aceita, política de reenvio.
- **Comportamento atual:** interface `ErpOrderExporter` + adapter `NotConfigured`. `erp_outbox` acumula pedidos confirmados; nada é enviado. **Não inventamos formato a partir do HTML.**

### Q3. Campos obrigatórios do cliente/pedido para a futura integração
- **Falta:** quais campos o ERP exigirá no pedido (ex.: código de condição de pagamento, transportadora, natureza de operação)?
- **Comportamento atual:** validação marca como "erro obrigatório" apenas o que temos certeza; itens 🟡 ficam como aviso configurável até confirmação.

## 🟡 Semântica de campos (preservados brutos até confirmar)

### Q4. Tail do tipo 22 (offsets 77–100)
Bloco `00.0000001.000000...` — contém peso? fator/múltiplo comercial? flags de ativo/lançamento? NCM? **Preservado em `products.raw_tail`.** O múltiplo comercial **não** é aplicado até confirmação (item do prompt: "somente quando confirmado").

### Q5. Referência do offset 101–104 do tipo 22 → tipo 45
471/946 casam com códigos do tipo 45 ("tipos adicionais": ESMALTE DAILUS, PELE, OLHOS…). É categoria de merchandising? Confirmar uso.

### Q6. Tipo 12 (financeiro/crédito) e tipo 15 (títulos)
Semântica interna dos 49B/132B. Quais campos são limite, saldo devedor, atraso, situação? **Exibição financeira fica sob permissão específica e só mostra o confirmado.**

### Q7. Tipos 80/82 (pedidos/movimentações do ERP)
As 2 datas do tipo 80 são emissão + entrega? faturamento? O tipo 82 traz preço praticado e desconto por item? **Isolados como `erp_movements_raw`; não alimentam o motor novo.** Servem para "últimos pedidos" e "produtos comprados" **apenas após** confirmação dos campos.

### Q8. Tipo 42/62 (condições de pagamento e detalhes)
Como montar a lista de condições permitidas por cliente/tabela? Prazos e parcelas ficam no 62?

### Q9. Tipo 47 (cidades) e vínculo com cliente
Código IBGE? Chave usada no tipo 10 é código de cidade do 47 ou texto livre?

### Q10. Marcador `***` (offsets 2–4 dos registros de produto/estrutura)
Significado do literal `***`? Filial? Versão de sub-registro? Sempre constante nesta base.

### Q11. Heurística de inativo (`Z*`, `Z `, `[INATIVO]`) em tipos 05 e 43
É convenção oficial de inativação no ERP ou apenas texto de rótulo? Precisamos de um flag real de ativo/inativo.

## 🟢 Regras de negócio a definir (produto/comercial, não técnicas do ERP)

- **Q12.** Valor mínimo de pedido (global? por cliente/segmento/tabela?).
- **Q13.** Faixas de desconto e autoridade de aprovação (matriz `approval_rules`).
- **Q14.** Política de produto ausente em nova importação: marcar inativo? em quantos ciclos? (config `missing_after_import_policy`).
- **Q15.** Visibilidade de equipes para supervisor/gerente (quais carteiras cada um enxerga).
- **Q16.** Quais perfis podem ver dados financeiros do cliente (títulos, limite).

## Fatos JÁ confirmados (não requerem pergunta)
- Layout, encoding, contagens, header/trailer, mecanismo dos 3 registros quebrados.
- Catálogo = tipo 22 (946). Estoque catálogo: 393+/397 zero/156−.
- Tabelas 002/012/033/053/055/061. Cobertura 1.589–4.056.
- Carteira: representante(3 díg) → clientes. HTML: 261 EANs, origem `erp_fastreport_html`.
