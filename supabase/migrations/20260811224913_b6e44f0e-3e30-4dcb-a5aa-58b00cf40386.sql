CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select case
    when auth.uid() is not null and _user_id is distinct from auth.uid() then false
    else exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
  end
$$;

CREATE OR REPLACE FUNCTION public.visible_seller_codes(_user_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select seller_erp_code from public.user_erp_seller_links
   where user_id = _user_id
     and (auth.uid() is null or _user_id = auth.uid())
  union
  select seller_erp_code from public.team_visibility
   where user_id = _user_id
     and (auth.uid() is null or _user_id = auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ops(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_seller(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_order_items(uuid) TO authenticated;