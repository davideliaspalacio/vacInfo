-- ─────────────── Segundo toro en el servicio y tope de 2 dosis por día ───────────────
--
-- El cliente: «Cuando se realiza un servicio real se pueden introducir dos pajillas de diferentes
-- toros a la vaca (esperando que una logre fecundar) en el mismo horario. Se necesita integrar los
-- campos de "nombre toro 2" y "raza toro 2". Nota: solo se permiten dos dosis de pajillas por día,
-- sin importar la hora ni la cantidad (una en la mañana y una en la tarde, o dos en la mañana y
-- cero en la tarde): el máximo son 2 por día.»
--
-- ¿Por qué dos columnas nuevas y no una segunda fila de `servicios`?
--   · La tabla ya tiene el índice único (animal_id, fecha): un día de la vaca es una fila. Los
--     informes y el ciclo reproductivo cuentan los servicios por filas, así que meter la segunda
--     pajilla como fila aparte duplicaría el número de servicios del año y movería los indicadores
--     (servicios por preñez, intervalos, última monta) sin que la finca hubiera hecho dos
--     servicios distintos.
--   · La planilla de papel de la finca lleva las dos pajillas en el mismo renglón del día: dos
--     columnas reproducen el papel.
--   · El tope de 2 dosis queda estructural: en una fila con dos pares de columnas de toro no cabe
--     una tercera dosis, pase lo que pase con la aplicación.
--
-- La segunda pajilla es opcional: un servicio con un solo toro se guarda igual que siempre.

alter table servicios add column if not exists toro2_nombre text;
alter table servicios add column if not exists toro2_raza text;

comment on column servicios.toro2_nombre is
  'Segunda pajilla del día (opcional): nombre del segundo toro. Máximo 2 dosis por vaca y día, sin importar la hora.';
comment on column servicios.toro2_raza is
  'Segunda pajilla del día (opcional): raza del segundo toro.';

-- No hay toro 2 sin toro 1: si solo se conoce un toro, va en `toro_nombre`.
alter table servicios drop constraint if exists servicios_toro2_sin_toro1;
alter table servicios add constraint servicios_toro2_sin_toro1
  check (coalesce(toro2_nombre, toro2_raza) is null or toro_nombre is not null);

-- ─────────────── Registrar el servicio respetando el tope del día ───────────────
--
-- Las dos pajillas pueden entrar de dos maneras y la función atiende las dos:
--   a) en el mismo formulario (toro 1 y toro 2): una sola fila nueva con las dos dosis;
--   b) en dos registros del mismo día (una en la mañana, otra en la tarde): el segundo registro
--      completa `toro2_*` de la fila que ya existe, porque el índice único (animal_id, fecha) no
--      deja crear otra fila y el trabajador no tiene permiso de UPDATE sobre `servicios`
--      (la política «corregir» pide `puede_gestionar_finca`). Por eso la función es
--      `security definer` y revisa `puede_registrar_animal` a mano, igual que `registrar_parto`.
--
-- Un reenvío de la cola sin señal con el mismo toro que ya está guardado devuelve 'repetido' y no
-- toca nada: así un registro que se sincroniza dos veces no se convierte en una segunda dosis.
-- La `jornada` guardada es la del primer registro del día: el tope se cuenta por día, no por hora.

create or replace function registrar_servicio(p_servicio jsonb) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_animal uuid := (p_servicio ->> 'animal_id')::uuid;
  v_fecha  date := (p_servicio ->> 'fecha')::date;
  v_toro1  text := nullif(btrim(coalesce(p_servicio ->> 'toro_nombre', '')), '');
  v_raza1  text := nullif(btrim(coalesce(p_servicio ->> 'toro_raza', '')), '');
  v_toro2  text := nullif(btrim(coalesce(p_servicio ->> 'toro2_nombre', '')), '');
  v_raza2  text := nullif(btrim(coalesce(p_servicio ->> 'toro2_raza', '')), '');
  -- Dosis que trae este registro: la pajilla del toro 1 y, si viene, la del toro 2.
  v_dosis  integer := 1 + (case when v_toro2 is not null or v_raza2 is not null then 1 else 0 end);
  v_fila   servicios;
  v_dia    integer;
begin
  if v_animal is null or v_fecha is null then
    raise exception 'Faltan el animal o la fecha del servicio';
  end if;
  if not puede_registrar_animal(v_animal) then
    raise exception 'No tienes permiso para registrar servicios de este animal';
  end if;
  if v_toro2 is not null and v_toro1 is null then
    raise exception 'Escribe primero el nombre del toro 1: no se puede guardar solo el toro 2';
  end if;

  select * into v_fila from servicios where animal_id = v_animal and fecha = v_fecha;

  if not found then
    insert into servicios (id, animal_id, fecha, tipo, toro_nombre, toro_raza, toro2_nombre, toro2_raza, inseminador, jornada, observaciones)
    values (
      coalesce(nullif(p_servicio ->> 'id', '')::uuid, gen_random_uuid()),
      v_animal,
      v_fecha,
      coalesce(nullif(p_servicio ->> 'tipo', '')::tipo_servicio, 'inseminacion'),
      v_toro1,
      v_raza1,
      v_toro2,
      v_raza2,
      nullif(btrim(coalesce(p_servicio ->> 'inseminador', '')), ''),
      nullif(p_servicio ->> 'jornada', '')::jornada,
      nullif(btrim(coalesce(p_servicio ->> 'observaciones', '')), '')
    );
    return 'nuevo';
  end if;

  -- Dosis que ya tiene ese día la vaca.
  v_dia := 1 + (case when v_fila.toro2_nombre is not null or v_fila.toro2_raza is not null then 1 else 0 end);

  -- El mismo toro que ya está guardado (o un registro sin nombre de toro): no es una dosis nueva.
  if v_toro1 is null
     or lower(v_toro1) = lower(coalesce(v_fila.toro_nombre, ''))
     or lower(v_toro1) = lower(coalesce(v_fila.toro2_nombre, '')) then
    return 'repetido';
  end if;

  if v_dia + v_dosis > 2 then
    raise exception 'Máximo 2 dosis de pajilla por vaca y día: el % esa vaca ya tiene % y este registro trae % más.',
      to_char(v_fecha, 'DD/MM/YYYY'), v_dia, v_dosis;
  end if;

  update servicios
     set toro2_nombre = v_toro1,
         toro2_raza = coalesce(v_raza1, toro2_raza)
   where id = v_fila.id;
  return 'completado';
end;
$$;

comment on function registrar_servicio(jsonb) is
  'Guarda el servicio del día de la vaca. Si el día ya tenía una pajilla de otro toro, la nueva queda como toro 2; con 2 dosis ya registradas rechaza la tercera. Máximo 2 dosis por vaca y día.';

revoke execute on function registrar_servicio(jsonb) from anon, public;
grant execute on function registrar_servicio(jsonb) to authenticated;
