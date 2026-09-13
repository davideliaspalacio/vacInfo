-- Reglas que antes solo validaba la aplicación.

-- ─────────────── Propietarios protegidos ───────────────
create function proteger_propietarios() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor_rol rol_miembro;
  fila miembros := coalesce(old, new);
begin
  -- Cambios hechos por el sistema (sin usuario, p. ej. crear_organizacion) no se restringen.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  select rol into actor_rol from miembros where organizacion_id = fila.organizacion_id and usuario_id = auth.uid();

  -- El primer propietario de una empresa recién creada no tiene quién lo autorice.
  if tg_op = 'INSERT' and new.rol = 'propietario'
     and not exists (select 1 from miembros where organizacion_id = new.organizacion_id) then
    return new;
  end if;

  if (tg_op in ('UPDATE', 'DELETE') and old.rol = 'propietario') or (tg_op in ('INSERT', 'UPDATE') and new.rol = 'propietario') then
    if coalesce(actor_rol, 'trabajador') <> 'propietario' then
      raise exception 'Solo un propietario puede asignar o quitar el rol de propietario';
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.rol = 'propietario' and (tg_op = 'DELETE' or new.rol <> 'propietario') then
    if not exists (
      select 1 from miembros
      where organizacion_id = old.organizacion_id and rol = 'propietario' and usuario_id <> old.usuario_id
    ) then
      raise exception 'La empresa debe tener al menos un propietario';
    end if;
  end if;

  return coalesce(new, old);
end $$;

create trigger proteger_propietarios before insert or update or delete on miembros
  for each row execute function proteger_propietarios();

-- ─────────────── Invitaciones: un usuario, una empresa; códigos legibles ───────────────
create function generar_codigo() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

alter table invitaciones alter column codigo set default generar_codigo();

create or replace function aceptar_invitacion(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invitaciones;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para usar el código';
  end if;

  select * into inv from invitaciones where codigo = upper(trim(p_codigo)) for update;
  if not found or not inv.activa or inv.expira_en <= now() or inv.usos >= inv.usos_max then
    raise exception 'El código no es válido o ya venció';
  end if;

  if exists (select 1 from miembros where usuario_id = uid and organizacion_id <> inv.organizacion_id) then
    raise exception 'Tu usuario ya pertenece a otra empresa';
  end if;

  insert into miembros (organizacion_id, usuario_id, rol, fincas)
  values (inv.organizacion_id, uid, inv.rol, case when inv.finca_id is null then null else array[inv.finca_id] end)
  on conflict (organizacion_id, usuario_id) do nothing;

  update invitaciones set usos = usos + 1 where id = inv.id;
  return inv.organizacion_id;
end $$;

-- ─────────────── Pesajes: quien registró puede corregir el mismo día ───────────────
create policy "corregir mi pesaje" on pesajes for update to authenticated
  using (registrado_por = (select auth.uid()) and registrado_en > now() - interval '1 day');

-- ─────────────── Parto y cría en una sola operación ───────────────
-- p_cria: null para no crear la ficha; si viene, {codigo, nombre, chapeta, sexo, raza}
create function registrar_parto(p_parto jsonb, p_cria jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  madre animales;
  cria_id uuid;
  parto_id uuid;
begin
  select * into madre from animales where id = (p_parto ->> 'animal_id')::uuid;
  if not found or not puede_ver_animal(madre.id) then
    raise exception 'No tienes acceso a este animal';
  end if;

  if exists (select 1 from partos where animal_id = madre.id and fecha = (p_parto ->> 'fecha')::date) then
    raise exception 'Ya hay un parto registrado para esta vaca en esa fecha';
  end if;

  if p_cria is not null then
    insert into animales (finca_id, codigo, chapeta, nombre, categoria, sexo, raza, fecha_nacimiento, madre_id, madre_nombre)
    values (
      madre.finca_id,
      p_cria ->> 'codigo',
      nullif(p_cria ->> 'chapeta', ''),
      p_cria ->> 'nombre',
      case when p_cria ->> 'sexo' = 'macho' then 'ternero'::categoria_animal else 'ternera'::categoria_animal end,
      (p_cria ->> 'sexo')::sexo,
      nullif(p_cria ->> 'raza', ''),
      (p_parto ->> 'fecha')::date,
      madre.id,
      madre.nombre
    )
    returning id into cria_id;
  end if;

  insert into partos (
    animal_id, fecha, cria_sexo, cria_raza, cria_id, en_la_noche, nacido_vivo, aborto,
    toma_calostro, persona_calostro, placenta_expulsada, lavado, observaciones
  ) values (
    madre.id,
    (p_parto ->> 'fecha')::date,
    nullif(p_parto ->> 'cria_sexo', '')::sexo,
    nullif(p_parto ->> 'cria_raza', ''),
    cria_id,
    (p_parto ->> 'en_la_noche')::boolean,
    coalesce((p_parto ->> 'nacido_vivo')::boolean, true),
    coalesce((p_parto ->> 'aborto')::boolean, false),
    (p_parto ->> 'toma_calostro')::boolean,
    nullif(p_parto ->> 'persona_calostro', ''),
    (p_parto ->> 'placenta_expulsada')::boolean,
    (p_parto ->> 'lavado')::boolean,
    nullif(p_parto ->> 'observaciones', '')
  )
  returning id into parto_id;

  -- Una novilla que pare pasa a ser vaca.
  update animales set categoria = 'vaca' where id = madre.id and categoria = 'novilla';

  return parto_id;
end $$;

-- Novillas que ya parieron (p. ej. cargadas por el importador) pasan a vacas.
update animales a set categoria = 'vaca'
where a.categoria = 'novilla' and exists (select 1 from partos p where p.animal_id = a.id and not p.aborto);

revoke execute on function registrar_parto(jsonb, jsonb), generar_codigo(), proteger_propietarios() from anon, public;
grant execute on function registrar_parto(jsonb, jsonb), generar_codigo() to authenticated;
