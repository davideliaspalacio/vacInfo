-- Datos de demostración de la fase 2 (inventario, levante, potreros, invitaciones).
-- Todo lo marcado aquí es de ejemplo; no viene de las planillas de la finca.

update organizaciones set plan = 'fundador', prueba_hasta = null
where id = '00000000-0000-4000-8000-000000000001';

update fincas set dias_descanso_objetivo = 18 where id = '00000000-0000-4000-8000-000000000101';

-- ─────────────── Inventario ───────────────
update insumos set consumo_diario_fuente = 'concentrado_vacas', stock_minimo = 40 where nombre = 'Concentrado vacas leche';
update insumos set consumo_diario_fuente = 'sal_vacas', stock_minimo = 5 where nombre = 'Sal mineralizada';
update insumos set consumo_diario_fuente = 'concentrado_terneras', stock_minimo = 5 where nombre = 'Concentrado terneras';

insert into movimientos_insumos (finca_id, producto, fecha, hora, tipo, cantidad, entrega, recibe) values
  ('00000000-0000-4000-8000-000000000101', 'Concentrado vacas leche', '2026-04-15', '10:00', 'ingreso', 120, 'Colanta', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', 'Sal mineralizada', '2026-04-10', '10:00', 'ingreso', 10, 'Colanta', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', 'Concentrado terneras', '2026-04-10', '10:00', 'ingreso', 20, 'Colanta', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', 'Colanta 34-8-8', '2026-04-25', '14:00', 'salida', 3, 'Nelson', 'Jhon Alex José');

insert into consumos_diarios (finca_id, fecha, kg_concentrado_vacas, kg_sal_vacas, kg_concentrado_terneras, kg_sal_terneras)
select '00000000-0000-4000-8000-000000000101', d::date, 360, 20, 16, 1
from generate_series('2026-04-17'::date, '2026-04-30'::date, interval '1 day') d;

-- ─────────────── Terneras nacidas en la finca (crías hembra desde oct-2025) ───────────────
with crias as (
  select p.animal_id as madre_id, p.fecha, a.nombre as madre, row_number() over (order by p.fecha, a.nombre) as n
  from partos p join animales a on a.id = p.animal_id
  where a.finca_id = '00000000-0000-4000-8000-000000000101' and p.cria_sexo = 'hembra' and p.fecha >= '2025-10-01'
)
insert into animales (finca_id, codigo, nombre, categoria, sexo, raza, fecha_nacimiento, madre_id, madre_nombre, fecha_destete, notas)
select '00000000-0000-4000-8000-000000000101', 'TON-T' || lpad(n::text, 2, '0'), 'Cría de ' || madre, 'ternera', 'hembra', null,
  fecha, madre_id, madre, case when fecha < '2025-12-01' then fecha + 90 end, 'Dato de demostración'
from crias;

update partos p set cria_id = a.id
from animales a
where a.madre_id = p.animal_id and a.fecha_nacimiento = p.fecha and a.codigo like 'TON-T%';

-- ─────────────── Terneronas de levante ───────────────
insert into animales (finca_id, codigo, chapeta, nombre, categoria, sexo, raza, fecha_nacimiento, fecha_destete, notas) values
  ('00000000-0000-4000-8000-000000000101', 'TON-N01', '501', 'Canela', 'ternerona', 'hembra', 'Jersey', '2024-10-20', '2025-01-18', 'Dato de demostración'),
  ('00000000-0000-4000-8000-000000000101', 'TON-N02', '502', 'Brisa', 'ternerona', 'hembra', 'Holstein', '2024-11-15', '2025-02-13', 'Dato de demostración'),
  ('00000000-0000-4000-8000-000000000101', 'TON-N03', '503', 'Luna', 'ternerona', 'hembra', 'Holstein', '2025-03-02', '2025-05-31', 'Dato de demostración'),
  ('00000000-0000-4000-8000-000000000101', 'TON-N04', '504', 'Pinta', 'ternerona', 'hembra', 'Gyr', '2025-07-10', '2025-10-08', 'Dato de demostración');

insert into pesajes (animal_id, fecha, peso_kg)
select a.id, g::date, round(38 + (g::date - a.fecha_nacimiento) * 0.7, 1)
from animales a, generate_series(a.fecha_nacimiento, '2026-04-30'::date, interval '30 days') g
where a.codigo like 'TON-T%';

insert into pesajes (animal_id, fecha, peso_kg)
select a.id, g::date, round(36 + (g::date - a.fecha_nacimiento) * 0.62, 1)
from animales a, generate_series(a.fecha_nacimiento, '2026-04-28'::date, interval '60 days') g
where a.codigo like 'TON-N%'
on conflict (animal_id, fecha) do nothing;

insert into pesajes (animal_id, fecha, peso_kg)
select a.id, '2026-04-28', round(36 + ('2026-04-28'::date - a.fecha_nacimiento) * 0.62, 1)
from animales a where a.codigo like 'TON-N%'
on conflict (animal_id, fecha) do nothing;

-- ─────────────── Rotación de potreros (mar–abr 2026) ───────────────
-- Vacas en ordeño: un día por potrero en los potreros 1–20. Horras: cinco días por potrero en 21–24.
insert into rotaciones_potrero (finca_id, potrero_id, grupo, animales, fecha_entrada, fecha_salida)
select p.finca_id, p.id, 'Vacas en ordeño', 43, d::date, case when d::date = '2026-04-30' then null else d::date + 1 end
from generate_series('2026-03-01'::date, '2026-04-30'::date, interval '1 day') d
join potreros p on p.finca_id = '00000000-0000-4000-8000-000000000101'
  and p.numero = ((d::date - '2026-03-01'::date) % 20) + 1;

insert into rotaciones_potrero (finca_id, potrero_id, grupo, animales, fecha_entrada, fecha_salida)
select p.finca_id, p.id, 'Vacas horras', 8, d::date, case when d::date = '2026-04-26' then null else d::date + 5 end
from generate_series('2026-03-02'::date, '2026-04-26'::date, interval '5 days') d
join potreros p on p.finca_id = '00000000-0000-4000-8000-000000000101'
  and p.numero = 21 + ((d::date - '2026-03-02'::date) / 5) % 4;

insert into aplicaciones_campo (finca_id, fecha, tipo, producto, cantidad, unidad, potreros, dias_retiro_pastoreo, personas) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-28', 'fumigacion', 'Fungicida', 200, 'cc por caneca', '3, 4', 5, 'Jhon Alex José');

-- ─────────────── Invitación de ejemplo ───────────────
insert into invitaciones (organizacion_id, finca_id, rol, codigo, usos_max, expira_en, creado_por) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'trabajador', 'TONELE', 50, '2027-12-31',
   '10000000-0000-4000-8000-000000000002');

-- ─────────────── Consumo automático (ejemplo) ───────────────
-- Premex: 50 g por vaca en ordeño por día, sin registrar cada salida.
insert into movimientos_insumos (finca_id, producto, fecha, hora, tipo, cantidad, entrega, recibe)
select '00000000-0000-4000-8000-000000000101', 'Premex', '2026-04-01', '09:00', 'ingreso', 20, 'Colanta', 'Nelson'
where not exists (
  select 1 from movimientos_insumos where finca_id = '00000000-0000-4000-8000-000000000101' and producto = 'Premex' and fecha = '2026-04-01'
);

insert into consumos_programados (finca_id, insumo_id, modo, cantidad, en_kg, periodo, grupo, desde, notas)
select '00000000-0000-4000-8000-000000000101', i.id, 'por_animal', 0.05, true, 'dia', 'vacas_ordeno', '2026-04-01', 'Dato de demostración'
from insumos i
where i.organizacion_id = '00000000-0000-4000-8000-000000000001' and i.nombre = 'Premex'
  and not exists (select 1 from consumos_programados c where c.finca_id = '00000000-0000-4000-8000-000000000101' and c.insumo_id = i.id);
