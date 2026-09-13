-- VacInfo / VacDaTa — esquema base
-- Toda tabla de eventos guarda quién y cuándo registró (requisito de las hojas informativas).

create extension if not exists pgcrypto;

-- ─────────────────────────── Tipos ───────────────────────────
create type rol_miembro as enum ('propietario', 'administrador', 'mayordomo', 'trabajador', 'veterinario', 'consultor');
create type especie as enum ('bovino', 'equino', 'canino', 'ave', 'otro');
create type categoria_animal as enum ('vaca', 'novilla', 'ternerona', 'ternera', 'ternero', 'toro', 'caballo', 'perro', 'otro');
create type sexo as enum ('hembra', 'macho');
create type estado_animal as enum ('activo', 'vendido', 'retirado', 'muerto');
create type jornada as enum ('am', 'pm');
create type tipo_servicio as enum ('inseminacion', 'monta');
create type resultado_palpacion as enum ('prenada', 'vacia');
create type tipo_evento_sanitario as enum (
  'enfermedad', 'tratamiento', 'vacuna', 'mastitis', 'cojera', 'fiebre', 'entamborada', 'fiebre_leche', 'cirugia', 'desparasitacion'
);
create type estado_sanitario as enum ('activo', 'en_tratamiento', 'resuelto');
create type tipo_baja as enum ('venta', 'retiro', 'muerte');
create type tipo_bien as enum ('equipo', 'vehiculo', 'herramienta', 'maquinaria', 'infraestructura', 'otro');
create type estado_bien as enum ('bueno', 'mantenimiento', 'malo');
create type categoria_insumo as enum (
  'concentrado', 'sal', 'mineral', 'abono', 'cal', 'fertilizante', 'veneno', 'medicamento', 'aseo', 'semen', 'otro'
);
create type tipo_movimiento as enum ('ingreso', 'salida');
create type tipo_aplicacion as enum ('fumigacion', 'fertilizacion', 'abonada', 'encalada', 'veneno_mosca', 'veneno_roedores');
create type tipo_control as enum ('agua', 'temperatura_tanque');
create type tipo_mantenimiento as enum ('equipo_ordeno', 'tanque', 'cercas', 'equipos', 'general');
create type urgencia as enum ('baja', 'media', 'alta');
create type estado_comentario as enum ('nuevo', 'leido', 'resuelto');
create type frecuencia_tarea as enum ('diaria', 'frecuente');

-- ───────────────────── Organización y usuarios ─────────────────────
create table organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  creado_en timestamptz not null default now()
);

create table perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre_completo text not null default '',
  telefono text,
  creado_en timestamptz not null default now()
);

create table miembros (
  organizacion_id uuid not null references organizaciones on delete cascade,
  usuario_id uuid not null references auth.users on delete cascade,
  rol rol_miembro not null default 'trabajador',
  creado_en timestamptz not null default now(),
  primary key (organizacion_id, usuario_id)
);
create index on miembros (usuario_id);

create function crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre_completo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre_completo', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function crear_perfil();

-- ─────────────────────────── Fincas ───────────────────────────
create table fincas (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones on delete cascade,
  nombre text not null,
  departamento text,
  municipio text,
  vereda text,
  direccion text,
  area_cuadras numeric,
  tenencia text check (tenencia in ('propia', 'arrendada')),
  registro_ica text,
  empresa_compradora text,
  codigo_asociado text,
  tanque_numero text,
  ruta text,
  contrato_energia text,
  precio_litro numeric,
  foto_url text,
  creado_en timestamptz not null default now()
);
create index on fincas (organizacion_id);

create table potreros (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  numero int not null,
  nombre text,
  area_cuadras numeric,
  unique (finca_id, numero)
);

-- ─────────────────────────── Seres vivos ───────────────────────────
create table animales (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  codigo text not null,
  chapeta text,
  nombre text not null,
  especie especie not null default 'bovino',
  categoria categoria_animal not null default 'vaca',
  sexo sexo not null default 'hembra',
  raza text,
  color text,
  fecha_nacimiento date,
  peso_kg numeric,
  metodo_adquisicion text,
  padre_nombre text,
  madre_id uuid references animales on delete set null,
  madre_nombre text,
  estado estado_animal not null default 'activo',
  foto_url text,
  notas text,
  creado_en timestamptz not null default now(),
  unique (finca_id, codigo)
);
create index on animales (finca_id, estado);

-- Columnas de auditoría compartidas por los eventos
-- registrado_por: usuario que capturó el dato · registrado_en: momento de captura

create table ordenos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  jornada jornada not null,
  litros numeric not null check (litros >= 0),
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  unique (animal_id, fecha, jornada)
);
create index on ordenos (fecha);

create table servicios (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  tipo tipo_servicio not null default 'inseminacion',
  toro_nombre text,
  toro_raza text,
  inseminador text,
  jornada jornada,
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on servicios (animal_id, fecha desc);

create table palpaciones (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  resultado resultado_palpacion not null,
  dias_prenez int,
  veterinario text,
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on palpaciones (animal_id, fecha desc);

create table partos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  cria_sexo sexo,
  cria_raza text,
  cria_id uuid references animales on delete set null,
  en_la_noche boolean,
  nacido_vivo boolean not null default true,
  aborto boolean not null default false,
  toma_calostro boolean,
  persona_calostro text,
  placenta_expulsada boolean,
  lavado boolean,
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on partos (animal_id, fecha desc);

create table secados (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  motivo text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on secados (animal_id, fecha desc);

create table eventos_sanitarios (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  tipo tipo_evento_sanitario not null,
  diagnostico text,
  producto text,
  lote text,
  registro_ica text,
  dosis text,
  via_administracion text,
  fecha_fin date,
  dias_retiro int,
  cuartos text[] check (cuartos <@ array['TDD', 'TDI', 'TTD', 'TTI']),
  frecuencia text,
  proxima_fecha date,
  estado estado_sanitario not null default 'activo',
  veterinario text,
  tarjeta_profesional text,
  operario text,
  observaciones text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);
create index on eventos_sanitarios (animal_id, fecha desc);

create table bajas (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references animales on delete cascade,
  fecha date not null,
  tipo tipo_baja not null,
  causa text,
  responsable_traslado text,
  valor numeric,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create function aplicar_baja() returns trigger language plpgsql as $$
begin
  update animales set estado = case new.tipo
    when 'venta' then 'vendido'::estado_animal
    when 'muerte' then 'muerto'::estado_animal
    else 'retirado'::estado_animal end
  where id = new.animal_id;
  return new;
end $$;
create trigger al_registrar_baja after insert on bajas for each row execute function aplicar_baja();

-- ─────────────────────────── Bienes e insumos ───────────────────────────
create table bienes (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  codigo text not null,
  nombre text not null,
  tipo tipo_bien not null default 'equipo',
  marca text,
  metodo_adquisicion text,
  fecha_adquisicion date,
  garantia_hasta date,
  estado estado_bien not null default 'bueno',
  descripcion text,
  recordatorio text,
  foto_url text,
  creado_en timestamptz not null default now(),
  unique (finca_id, codigo)
);

create table insumos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones on delete cascade,
  nombre text not null,
  categoria categoria_insumo not null,
  unidad text not null default 'bulto',
  contenido numeric,
  precio numeric,
  unique (organizacion_id, nombre)
);

-- ─────────────────────────── Registros de finca ───────────────────────────
create table movimientos_insumos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  insumo_id uuid references insumos on delete set null,
  producto text not null,
  fecha date not null default current_date,
  hora time,
  tipo tipo_movimiento not null,
  cantidad numeric not null,
  entrega text,
  recibe text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table consumos_diarios (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null default current_date,
  kg_concentrado_vacas numeric,
  kg_sal_vacas numeric,
  kg_concentrado_terneras numeric,
  kg_sal_terneras numeric,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  unique (finca_id, fecha)
);

create table recolecciones_leche (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null default current_date,
  litros numeric not null,
  placa text,
  conductor text,
  celular_conductor text,
  entregado_por text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table aplicaciones_campo (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null default current_date,
  tipo tipo_aplicacion not null,
  producto text not null,
  cantidad numeric,
  unidad text,
  potreros text,
  area text,
  dias_retiro_pastoreo int,
  animales_tratados int,
  jornada jornada,
  personas text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table controles_calidad (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null default current_date,
  tipo tipo_control not null,
  jornada jornada,
  muestra text,
  ph numeric,
  cloro numeric,
  grados numeric,
  estado text,
  tratamiento text,
  responsable text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table mantenimientos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  bien_id uuid references bienes on delete set null,
  fecha date not null default current_date,
  tipo tipo_mantenimiento not null,
  detalle text not null,
  potreros text,
  materiales text,
  responsable text,
  celular text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table visitas (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  fecha date not null default current_date,
  hora_ingreso time,
  nombre text not null,
  cedula text,
  empresa text,
  placa text,
  motivo text,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

-- ─────────────────────────── Comunicación ───────────────────────────
create table comentarios (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones on delete cascade,
  finca_id uuid references fincas on delete set null,
  mensaje text not null,
  urgencia urgencia not null default 'media',
  estado estado_comentario not null default 'nuevo',
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now()
);

create table mensajes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones on delete cascade,
  remitente_id uuid references auth.users default auth.uid(),
  destinatario_id uuid references auth.users, -- null = todos
  texto text not null,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ─────────────────────────── Finanzas ───────────────────────────
-- Parámetros del modelo de costos (hoja INFORMACION del Excel del consultor), por finca y mes.
create table parametros_costos (
  id uuid primary key default gen_random_uuid(),
  finca_id uuid not null references fincas on delete cascade,
  periodo date not null check (extract(day from periodo) = 1),
  datos jsonb not null,
  registrado_por uuid references auth.users default auth.uid(),
  registrado_en timestamptz not null default now(),
  unique (finca_id, periodo)
);

-- ─────────────────────────── Catálogos globales ───────────────────────────
create table tareas_manual (
  id serial primary key,
  frecuencia frecuencia_tarea not null,
  orden int not null,
  descripcion text not null
);

create table plan_sanitario (
  id serial primary key,
  enfermedad text not null,
  joven text,
  adulto text,
  observaciones text
);
