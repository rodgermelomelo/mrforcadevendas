insert into public.brand_taxonomy_overrides (category_name, target_brand_name)
values ('SOBRANCELHA','DAILUS'),('SOBRANCELHAS','DAILUS'),('SOBRANCELHA DAIL','DAILUS'),('LAPIS SOBRANCELHA','DAILUS'),('GEL','DAILUS'),('SKINCARE','DAILUS'),('SKIN','DAILUS')
on conflict (category_name) do update set target_brand_name = excluded.target_brand_name;