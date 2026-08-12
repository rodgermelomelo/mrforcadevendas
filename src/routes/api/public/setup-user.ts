import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/setup-user')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
          
          const email = "marcio@mrcosmeticos.com.br";
          const password = "Marcio123!";
          const fullName = "Márcio";
          const role = "vendedor_externo";

          // 1. Check if user exists
          const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
          const user = existingUser?.users.find(u => u.email === email);
          
          let userId: string;
          
          if (user) {
            userId = user.id;
          } else {
            const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName }
            });
            if (authError) throw authError;
            userId = created.user.id;
          }

          // 2. Role
          await supabaseAdmin.from('user_roles').upsert({ user_id: userId, role });

          // 3. Profile
          await supabaseAdmin.from('profiles').upsert({ id: userId, full_name: fullName, email });

          return new Response(JSON.stringify({ success: true, userId, message: "Usuário Márcio configurado com sucesso." }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
