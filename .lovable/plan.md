# Plano: Melhorias no Mapa e Menu Lateral Retrátil

O objetivo deste plano é resolver as falhas de renderização do mapa, adicionar funcionalidades de interação (ampliar) e transformar o menu lateral estático em um menu retrátil (collapsible) para otimizar o espaço em telas menores ou durante a visualização do mapa.

## Ações Sugeridas

### 1. Robustez do Mapa e Novos Recursos
- **Validações de Tiles**: Adicionar verificação explícita de `subdomains` e garantir que o fallback para "Esri Street" ocorra imediatamente em caso de erro na URL do provedor principal.
- **Botão de Ampliar**: Adicionar um botão "Maximizar" no componente `CustomerTileMap` que permite visualizar o mapa em tela cheia (Fullscreen API ou overlay fixo), facilitando a análise de grandes volumes de dados.

### 2. Menu Lateral Retrátil (Collapsible Sidebar)
- **Migração para Shadcn Sidebar**: Substituir o `aside` fixo no `AppShell` pelo componente `Sidebar` do Shadcn (já presente no projeto), permitindo que o usuário recolha o menu para o modo ícones.
- **Toggle de Visibilidade**: Adicionar o `SidebarTrigger` no cabeçalho ou no topo do menu lateral para controle do usuário.
- **Persistência**: O estado do menu (aberto/fechado) será salvo em cookies para manter a preferência do usuário entre sessões.

### 3. Ajustes de Layout
- Garantir que o conteúdo principal (`main`) se ajuste suavemente à mudança de largura do menu lateral.
- Otimizar o cabeçalho mobile para manter a consistência com o novo menu lateral.

## Detalhes Técnicos

- **Componentes**: `src/components/app-shell.tsx`, `src/features/customers/customer-tile-map.tsx`.
- **Hooks**: Uso do `useSidebar` para controlar o estado do menu programaticamente se necessário.
- **CSS**: Utilização de variáveis de tema do Tailwind v4 (`--sidebar-width`, etc.) para animações fluidas.
- **Mapa**: Implementação de um estado `isFullscreen` no `CustomerTileMap` que altera as classes do container para `fixed inset-0 z-[60]`.
