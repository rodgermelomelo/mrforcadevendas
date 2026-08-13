# Plano de Implementação: Correção Geográfica de Pontos no Mapa

Ajustar a heurística de posicionamento para evitar que clientes sem coordenadas exatas sejam posicionados no mar, garantindo que o "spread" estatístico respeite os limites terrestres.

## Problema Identificado
Atualmente, clientes sem coordenadas conhecidas (`knownCoordinate: false`) são posicionados através de um cálculo de `spread` baseado no centro do estado ou da cidade. O parâmetro `distance` e `stateSpread` no arquivo `src/lib/customer-map.ts` pode estar muito elevado, empurrando pontos para fora do continente (especialmente em estados litorâneos como SP, RJ, BA, etc.).

## Alterações

### 1. Ajuste de Heurística em `src/lib/customer-map.ts`
- **Redução do Spread por Estado**: Diminuir o fator `stateSpread` na função `getBaseCoordinate` para manter a dispersão mais contida no interior do território.
- **Detecção de Litoral**: Implementar um ajuste específico para estados litorâneos, priorizando o spread para o interior (Oeste/Norte/Sul dependendo do estado) em vez de um círculo completo.
- **Refinamento de Coordenadas de Estado**: Ajustar os pontos centrais dos estados em `STATE_COORDS` para locais mais distantes da costa quando a intenção for evitar o mar.

### 2. Melhoria no Algoritmo de Spread de Pontos (`spreadCustomer`)
- Reduzir o raio máximo de dispersão (`distance`) para evitar que agrupamentos grandes em cidades litorâneas transbordem para o oceano.

## Detalhes Técnicos
- Arquivo alvo: `src/lib/customer-map.ts`.
- Variáveis chave: `BRAZIL_BOUNDS`, `STATE_COORDS`, `getBaseCoordinate`.
- Lógica: Mudar de dispersão circular uniforme para dispersão com viés territorial.
