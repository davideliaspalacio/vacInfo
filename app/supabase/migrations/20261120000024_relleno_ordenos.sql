-- ─────────────── Relleno de registros de ordeño faltantes ───────────────
--
-- Si un trabajador se olvida de registrar el ordeño por varios días, al hacer un registro nuevo
-- los días que quedaron en blanco se llenan con el mismo dato que se acaba de registrar (mismos
-- litros, misma jornada). Así el periodo sin registros queda con una aproximación al ordeño real
-- en vez de quedar en cero.
--
-- La opción se prende finca por finca (`fincas.relleno_ordenos`) y el administrador tiene que leer
-- la explicación y darle «Aplicar a la finca» en Hoja informativa › Editar finca.
--
-- ¿Por qué un disparador en `ordenos` y no en la aplicación?
-- Los ordeños entran por tres caminos distintos: la cola sin señal de VacDaTa
-- (`/api/campo/sincronizar` → `lib/offline/servidor.ts`), el importador de planillas y la propia
-- web. Un disparador en la tabla es el único lugar por el que pasan los tres, así que la regla no
-- se puede olvidar en un camino nuevo y tampoco depende de que el teléfono tenga señal.
-- Es por sentencia (no por fila) porque el ordeño por lista entra como un solo `insert` con una
-- fila por vaca: así se calcula el relleno de todas las vacas de la jornada de una sola pasada.
--
-- Cuidados:
--   · Solo rellena hacia atrás desde el último ordeño que ya tenía la vaca; nunca pisa un día que
--     ya tiene registro (lo frena `on conflict (animal_id, fecha, jornada) do nothing`, el mismo
--     índice único de la tabla).
--   · Tope de 15 días hacia atrás. Es una quincena: el negocio trabaja por planillas quincenales,
--     así que es el periodo que el administrador reconoce como «la quincena que no se registró».
--     Más allá de eso ya no es una aproximación sino inventar un mes, y rellenar un año entero por
--     un registro viejo dejaría la finca con datos falsos.
--   · No se dispara al cargar histórico: solo entran al relleno los ordeños del día de hoy o de
--     ayer (ayer porque la cola sin señal puede subirse pasada la medianoche). Un importador que
--     mete fechas viejas no rellena nada. Además se descarta la vaca que en la misma sentencia
--     recibe más de una fecha, que es la firma de una carga masiva.
--   · Los días rellenados quedan marcados con `ordenos.estimado = true` para poder distinguirlos
--     del dato que sí tomó una persona.
--   · El relleno no se rellena a sí mismo: la marca `vacinfo.relleno_en_curso` corta la recursión y
--     las filas estimadas quedan fuera de los candidatos.

alter table fincas add column if not exists relleno_ordenos boolean not null default false;

comment on column fincas.relleno_ordenos is
  'Relleno de registros de ordeño faltantes: al registrar un ordeño se completan los días en blanco desde el último ordeño de la vaca. Con la opción activa, VacDaTa solo registra el día actual.';

alter table ordenos add column if not exists estimado boolean not null default false;

comment on column ordenos.estimado is
  'true = el registro no lo tomó una persona: lo generó el relleno de registros de ordeño faltantes con el dato del ordeño siguiente.';

-- ─────────────── El relleno ───────────────

create or replace function rellenar_ordenos_faltantes()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  -- Tope de días hacia atrás: una quincena (ver el comentario de arriba).
  tope constant integer := 15;
begin
  -- El propio relleno inserta en `ordenos`: sin esta marca se llamaría a sí mismo.
  if coalesce(current_setting('vacinfo.relleno_en_curso', true), '') = 'si' then
    return null;
  end if;
  perform set_config('vacinfo.relleno_en_curso', 'si', true);

  insert into ordenos (animal_id, fecha, jornada, litros, estimado, registrado_por)
  select n.animal_id, dia::date, n.jornada, n.litros, true, n.registrado_por
    from (
      -- Un candidato por vaca y jornada: el registro más nuevo de la sentencia.
      select distinct on (nu.animal_id, nu.jornada)
             nu.animal_id, nu.jornada, nu.fecha, nu.litros, nu.registrado_por
        from nuevas nu
        join animales a on a.id = nu.animal_id
        join fincas f on f.id = a.finca_id
       where f.relleno_ordenos
         and not nu.estimado
         -- Solo el registro del día (o el de ayer, por la cola sin señal que sube de madrugada).
         and nu.fecha between current_date - 1 and current_date
         -- Carga masiva: la misma sentencia le trae varias fechas a la misma vaca.
         and not exists (select 1 from nuevas otra where otra.animal_id = nu.animal_id and otra.fecha <> nu.fecha)
       order by nu.animal_id, nu.jornada, nu.fecha desc
    ) n
    -- Desde cuándo no se registra nada de esta vaca.
    cross join lateral (
      select max(o.fecha) as ultimo from ordenos o where o.animal_id = n.animal_id and o.fecha < n.fecha
    ) u
    cross join lateral generate_series(
      greatest(u.ultimo + 1, n.fecha - tope)::timestamp,
      (n.fecha - 1)::timestamp,
      interval '1 day'
    ) as dia
   -- Una vaca sin ningún ordeño anterior no tiene periodo que rellenar.
   where u.ultimo is not null
      on conflict (animal_id, fecha, jornada) do nothing;

  -- Se libera para que otra sentencia de la misma transacción sí pueda rellenar.
  perform set_config('vacinfo.relleno_en_curso', '', true);
  return null;
end;
$$;

comment on function rellenar_ordenos_faltantes() is
  'Completa los días sin ordeño de la vaca (desde su último ordeño hasta el día anterior, con tope de 15 días) usando los litros y la jornada del registro nuevo. Solo en fincas con fincas.relleno_ordenos.';

drop trigger if exists relleno_tras_ordeno on ordenos;
create trigger relleno_tras_ordeno
  after insert on ordenos
  referencing new table as nuevas
  for each statement execute function rellenar_ordenos_faltantes();
