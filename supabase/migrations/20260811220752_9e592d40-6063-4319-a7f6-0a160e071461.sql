WITH new_order AS (
  INSERT INTO public.orders (
    number, 
    customer_erp_code, 
    customer_name, 
    seller_erp_code, 
    seller_name, 
    price_table_code, 
    price_level_label, 
    payment_term, 
    subtotal, 
    discount_total, 
    total, 
    order_discount_percent, 
    is_bonus, 
    notes, 
    status, 
    integration_status, 
    required_authority, 
    content_hash,
    created_by
  ) 
  VALUES (
    'PED-SIM-001', 
    '004512', 
    'Bela Forma', 
    'V001', 
    'Vendedor Demo', 
    'T01', 
    'Nível 2', 
    '28/56 dias', 
    106.50, 
    6.45, 
    100.05, 
    0, 
    false, 
    'Pedido de simulação para demonstração de status.', 
    'pending_approval', 
    'not_ready', 
    'supervisor', 
    'sim-hash-123',
    (SELECT id FROM auth.users LIMIT 1)
  ) 
  RETURNING id
),
items AS (
  INSERT INTO public.order_items (order_id, product_erp_code, product_name, quantity, unit_price, discount_percent, total)
  SELECT id, '220145', 'Batom Matte Intenso Rubi 3,5g', 5, 12.90, 10, 58.05 FROM new_order
  UNION ALL
  SELECT id, '231001', 'Esmalte Cremoso Rosa Vibrante 8ml', 10, 4.20, 0, 42.00 FROM new_order
),
exceptions AS (
  INSERT INTO public.commercial_exceptions (order_id, exception_type, label, detail, authority)
  SELECT id, 'discount_item', 'Desconto excessivo por item', 'Desconto de 10% excede o padrão da marca DAILUS.', 'supervisor' FROM new_order
)
INSERT INTO public.approval_events (order_id, action, detail, actor_id)
SELECT id, 'Enviado para aprovação', 'Pedido com exceção de desconto por item.', (SELECT id FROM auth.users LIMIT 1) FROM new_order;