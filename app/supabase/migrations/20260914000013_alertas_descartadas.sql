-- Notificaciones descartadas por usuario (Mensajes y notificaciones).
--
-- Las alertas no se guardan: `alertas_finca` las calcula al vuelo. Para descartarlas se guarda una
-- clave estable por usuario y finca, y la aplicación filtra las alertas cuya clave esté descartada.
-- `alertas_finca` no cambia.
--
-- Clave (la arma el servidor, ver src/app/(vacinfo)/mensajes/alertas.ts):
--   * Alertas con fecha objetivo fija (palpar, secar, parto, vacuna, retiro_leche, destete, programado):
--       clave = tipo || ':' || coalesce(animal_id::text, nombre) || ':' || fecha
--     visible_desde = null → queda descartada para siempre. Si cambia la fecha (nuevo servicio,
--     evento reprogramado) la clave es otra y la alerta vuelve a aparecer.
--   * Alertas "móviles", cuya fecha es el corte y cambia cada día (mora_prenez, insumo, novilla_lista):
--       clave = tipo || ':' || coalesce(animal_id::text, nombre)
--     visible_desde = current_date + 7 → se ocultan una semana; si el problema sigue, reaparecen.
--   Una fila oculta la alerta mientras visible_desde sea null o posterior a hoy.
--
-- Permisos: cada usuario ve, crea, actualiza (volver a descartar una alerta móvil que reapareció)
-- y borra (restaurar) solo sus filas, y solo de fincas que puede ver. El consultor también puede
-- descartar: es su propia vista de las notificaciones, no modifica datos de la finca.

create table alertas_descartadas (
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  finca_id uuid not null references fincas (id) on delete cascade,
  clave text not null check (length(clave) between 3 and 500),
  fecha_alerta date,
  descartada_en timestamptz not null default now(),
  visible_desde date,
  primary key (usuario_id, finca_id, clave)
);

create index alertas_descartadas_finca on alertas_descartadas (finca_id);

alter table alertas_descartadas enable row level security;

create policy "ver propias" on alertas_descartadas for select to authenticated
  using (usuario_id = (select auth.uid()) and puede_ver_finca(finca_id));
create policy "descartar" on alertas_descartadas for insert to authenticated
  with check (usuario_id = (select auth.uid()) and puede_ver_finca(finca_id));
create policy "volver a descartar" on alertas_descartadas for update to authenticated
  using (usuario_id = (select auth.uid()) and puede_ver_finca(finca_id))
  with check (usuario_id = (select auth.uid()) and puede_ver_finca(finca_id));
create policy "restaurar" on alertas_descartadas for delete to authenticated
  using (usuario_id = (select auth.uid()) and puede_ver_finca(finca_id));

grant select, insert, update, delete on alertas_descartadas to authenticated;
