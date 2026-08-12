# Corrigir catálogo indisponível e limite de clientes

## Diagnóstico confirmado

- Existem **4.910 clientes ativos** no banco, mas o carregamento para após os primeiros 1.000.
- Existem **946 produtos visíveis com registro de estoque**; **393 possuem saldo positivo**.
- O backend limita cada resposta a 1.000 linhas, enquanto o helper atual considera uma página completa como 2.000 linhas. Ao receber 1.000, ele interpreta incorretamente como última página.
- No estoque, a primeira página contém somente 4 produtos visíveis e nenhum deles com saldo positivo. Por isso, os demais produtos recebem saldo padrão zero e todo o catálogo aparece indisponível.
- A saúde do banco está normal (baixa ocupação de conexões e sem falta de memória), então não é necessário aumentar o servidor.

## Implementação

1. **Corrigir a paginação compartilhada**
   - Ajustar o tamanho de página ao limite real de 1.000 registros.
   - Continuar buscando páginas sucessivas até retornar uma página incompleta.
   - Remover limites redundantes que possam interferir no deslocamento das páginas.

2. **Carregar toda a carteira visível**
   - Aplicar a paginação corrigida a clientes e vínculos cliente–representante.
   - Preservar a RLS: cada usuário continuará recebendo somente os clientes permitidos para seu perfil.
   - Exibir os 4.910 clientes para administradores/gestores com acesso integral, sem corte em 1.000.

3. **Restaurar o estoque real no catálogo**
   - Buscar todas as páginas de `inventory_snapshots` e montar o mapa por código ERP.
   - Garantir que produtos sem registro permaneçam indisponíveis, mas que os 393 produtos com saldo positivo sejam reconhecidos corretamente.
   - Manter o carregamento dividido entre dados centrais e catálogo para não piorar a abertura das outras páginas.

4. **Eliminar o caminho legado inconsistente**
   - Alinhar o carregador antigo de catálogo ao mesmo helper paginado, evitando que outra rota volte a sofrer o corte de 1.000 registros.

## Validação

- Confirmar no app que a carteira ultrapassa 1.000 e chega ao total permitido pela conta.
- Confirmar no catálogo que produtos com saldo positivo aparecem disponíveis e que o filtro “Em estoque” retorna resultados.
- Testar busca de clientes próximos do fim da ordenação, inclusive no mapa.
- Verificar que navegação, catálogo e mapa continuam sem erros de console ou requisições.
