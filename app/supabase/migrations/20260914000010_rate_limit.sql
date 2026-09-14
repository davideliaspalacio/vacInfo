-- Límites de uso (rate limiting) guardados en Postgres: sin servicios ni variables nuevas.
--
-- Una fila por clave lógica ("login:ip:1.2.3.4", "campo-catalogo:usuario:<uuid>") con ventana fija.
-- La clave se guarda como sha256 para no dejar correos ni IP en claro.
--
-- Por qué exponer estas funciones por RPC (anon y authenticated) es aceptable:
-- - El inicio de sesión y el registro ocurren antes de tener sesión, y el servidor de Next solo tiene la llave publicable.
-- - La tabla no es accesible directamente (RLS sin políticas y sin privilegios); solo se usa a través de estas funciones.
-- - Las claves con alcance de usuario (":usuario:<uuid>") solo las puede consumir ese mismo usuario, así nadie agota la cuota ajena.
-- - reiniciar_limite solo borra el contador de intentos fallidos de la cuenta con la que se acaba de iniciar sesión.
-- - Quien llame a consumir_limite a mano solo puede gastar cuotas por IP o por cuenta; el mismo efecto se logra con
--   intentos fallidos desde el formulario, el bloqueo dura minutos y la API de Supabase (Auth y PostgREST) tiene sus propios límites.
-- - Estos límites son una capa extra de la app: Supabase Auth sigue aplicando los suyos a signInWithPassword y signUp.

create table limites_uso (
  clave text primary key,
  ventana_inicio timestamptz not null default now(),
  conteo int not null default 0,
  bloqueado_hasta timestamptz,
  vence_en timestamptz not null default now()
);

create index limites_uso_vence_idx on limites_uso (vence_en);

alter table limites_uso enable row level security;
revoke all on table limites_uso from anon, authenticated, public;

/**
 * Consume (o solo consulta, con p_consumir = false) una unidad de la clave.
 * Ventana fija de p_ventana_segundos con hasta p_maximo usos. Si p_bloqueo_segundos > 0, al llegar al máximo
 * la clave queda bloqueada ese tiempo contado desde el último uso (útil para intentos fallidos de inicio de sesión).
 */
create or replace function consumir_limite(
  p_clave text,
  p_maximo int,
  p_ventana_segundos int,
  p_bloqueo_segundos int default 0,
  p_consumir boolean default true
)
returns table (permitido boolean, restantes int, reintentar_en int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave text;
  v_maximo int := least(greatest(coalesce(p_maximo, 1), 1), 100000);
  v_ventana interval := make_interval(secs => least(greatest(coalesce(p_ventana_segundos, 1), 1), 604800));
  v_bloqueo interval := make_interval(secs => least(greatest(coalesce(p_bloqueo_segundos, 0), 0), 604800));
  v_ahora timestamptz := clock_timestamp();
  v_fila limites_uso;
  v_conteo int;
  v_inicio timestamptz;
  v_hasta timestamptz;
begin
  if p_clave is null or length(p_clave) = 0 or length(p_clave) > 300 then
    raise exception 'Clave de límite inválida' using errcode = '22023';
  end if;
  if p_clave like '%:usuario:%' and (auth.uid() is null or p_clave not like '%:usuario:' || auth.uid()::text) then
    raise exception 'La clave no corresponde al usuario' using errcode = '42501';
  end if;

  v_clave := encode(extensions.digest(p_clave, 'sha256'), 'hex');

  if random() < 0.01 then
    delete from limites_uso where vence_en < v_ahora;
  end if;

  if p_consumir then
    insert into limites_uso (clave, ventana_inicio, conteo, vence_en)
    values (v_clave, v_ahora, 0, v_ahora + v_ventana)
    on conflict (clave) do nothing;
    select * into v_fila from limites_uso where clave = v_clave for update;
  else
    select * into v_fila from limites_uso where clave = v_clave;
    if not found then
      return query select true, v_maximo, 0;
      return;
    end if;
  end if;

  -- Ventana vencida: el contador vuelve a cero.
  v_inicio := v_fila.ventana_inicio;
  v_conteo := v_fila.conteo;
  if v_inicio + v_ventana <= v_ahora then
    v_inicio := v_ahora;
    v_conteo := 0;
  end if;
  v_hasta := case when v_fila.bloqueado_hasta > v_ahora then v_fila.bloqueado_hasta end;

  if v_hasta is not null or v_conteo + 1 > v_maximo then
    return query select false, 0,
      greatest(1, ceil(extract(epoch from greatest(coalesce(v_hasta, v_ahora), v_inicio + v_ventana) - v_ahora))::int);
    return;
  end if;

  if not p_consumir then
    return query select true, v_maximo - v_conteo, 0;
    return;
  end if;

  v_conteo := v_conteo + 1;
  if v_conteo >= v_maximo and v_bloqueo > interval '0' then
    v_hasta := v_ahora + v_bloqueo;
  end if;

  update limites_uso
  set ventana_inicio = v_inicio,
      conteo = v_conteo,
      bloqueado_hasta = v_hasta,
      vence_en = greatest(v_inicio + v_ventana, coalesce(v_hasta, v_ahora))
  where clave = v_clave;

  return query select true, v_maximo - v_conteo, 0;
end $$;

/** Borra el contador de intentos fallidos de la cuenta con la que se acaba de iniciar sesión. */
create or replace function reiniciar_limite(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or v_correo = '' or p_clave is distinct from left('login:cuenta:' || v_correo, 300) then
    raise exception 'Solo puedes reiniciar el límite de tu propia cuenta' using errcode = '42501';
  end if;
  delete from limites_uso where clave = encode(extensions.digest(p_clave, 'sha256'), 'hex');
end $$;

revoke execute on function consumir_limite(text, int, int, int, boolean), reiniciar_limite(text) from public;
grant execute on function consumir_limite(text, int, int, int, boolean) to anon, authenticated;
grant execute on function reiniciar_limite(text) to authenticated;
