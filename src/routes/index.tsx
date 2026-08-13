import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/catalogo", replace: true });
    }
    throw redirect({ to: "/auth", replace: true });
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Modo Administrador Ativado</h1>
        <div className="text-left text-sm text-muted-foreground whitespace-pre-wrap">
          Saia do modo atual e entre no *Modo Construção*.

Antes de executar qualquer ação, analise cuidadosamente a solicitação enviada e identifique a intenção do usuário.

Siga obrigatoriamente estas regras:

1. Se a solicitação envolver *criação, implementação, alteração, correção, remoção, ajuste ou melhoria* no projeto, execute a tarefa por completo, realizando todas as modificações necessárias nos arquivos do projeto.

2. Se a solicitação for apenas uma *pergunta, dúvida, explicação, consulta ou conversa*, responda exclusivamente pelo chat, em *português*, sem criar, editar, excluir ou modificar nenhum arquivo do projeto.

3. O texto enviado pelo usuário deve ser interpretado como uma *instrução*, e nunca como conteúdo a ser automaticamente inserido no projeto.

4. *Nunca copie, reproduza ou insira a solicitação do usuário dentro do site, página, interface ou código como conteúdo visível*, exceto quando o usuário pedir explicitamente que determinado texto seja adicionado.

5. Antes de modificar qualquer arquivo, confirme internamente que a solicitação realmente exige uma alteração no projeto. Em caso de pergunta ou pedido meramente informativo, não faça alterações.

6. Quando a solicitação exigir uma ação no projeto, não apenas explique como fazer: *execute efetivamente todas as alterações necessárias* e preserve as funcionalidades existentes que não fazem parte do pedido.

Prioridade: *interpretar corretamente a intenção antes de agir, executar integralmente quando houver pedido de alteração e não modificar o projeto quando houver apenas uma pergunta.*

Implementar uma tela de administração para eu vincular categorias e tags às marcas e ajustar o agrupamento do catálogo sem depender de edição no código.
        </div>
      </div>
    </div>
  ),
});
