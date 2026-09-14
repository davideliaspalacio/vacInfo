# VacInfo · VacDaTa

Plataforma SaaS para la gestión de fincas lecheras. Tiene dos aplicaciones sobre la misma base de datos:

| App | Para quién | Dónde | Qué hace |
|---|---|---|---|
| **VacInfo** | Propietario, administrador, consultor, veterinario | Web (computador) | Fincas, fichas, informes, costos, indicadores, calendario, inventario, equipo, alertas |
| **VacDaTa** | Mayordomo y trabajadores | Celular (app instalable) | Registrar eventos **con o sin señal**, mensajes, aprendizaje, comentarios |

> Producción: https://app-blue-mu-45.vercel.app · Base de datos: Supabase Cloud · Hosting: Vercel

---

## Contenido

1. [Arquitectura](#1-arquitectura)
2. [Tecnologías](#2-tecnologías)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Roles y permisos](#4-roles-y-permisos)
5. [VacInfo (web)](#5-vacinfo-web)
6. [VacDaTa y el modo sin señal](#6-vacdata-y-el-modo-sin-señal)
7. [Registro de empresas e invitaciones](#7-registro-de-empresas-e-invitaciones)
8. [Reglas del negocio](#8-reglas-del-negocio)
9. [Modelo de datos](#9-modelo-de-datos)
10. [Base de datos: migraciones y funciones](#10-base-de-datos-migraciones-y-funciones)
11. [Desarrollo local](#11-desarrollo-local)
12. [Pruebas y control de calidad](#12-pruebas-y-control-de-calidad)
13. [Despliegue](#13-despliegue)
14. [Seguridad](#14-seguridad)
15. [Documentación relacionada y hoja de ruta](#15-documentación-relacionada-y-hoja-de-ruta)

---

## 1. Arquitectura

```mermaid
flowchart LR
    subgraph Campo["🐄 Finca"]
        T["📱 VacDaTa<br/>mayordomo · trabajador"]
        IDB[("IndexedDB<br/>catálogo + cola")]
        SW["Service worker<br/>app instalable"]
        T <--> IDB
        T <--> SW
    end

    subgraph Oficina["💻 Oficina / casa"]
        W["VacInfo<br/>propietario · administrador · consultor"]
    end

    subgraph Vercel["☁️ Vercel · Next.js"]
        SC["Server Components<br/>páginas"]
        SA["Server Actions<br/>formularios"]
        API["/api/campo/*<br/>catálogo · sincronizar · mensajes"]
        PX["proxy.ts<br/>sesión"]
    end

    subgraph Supabase["🗄️ Supabase"]
        AUTH["Auth<br/>correo o usuario + PIN"]
        PG[("Postgres<br/>RLS por empresa y rol")]
        FN["Funciones SQL<br/>estado reproductivo · alertas<br/>saldo insumos · indicadores"]
        PG --- FN
    end

    T -- "HTTPS cuando hay señal" --> API
    W -- HTTPS --> SC
    W --> SA
    SC --> PG
    SA --> PG
    API --> PG
    PX --> AUTH
```

- **Una sola app Next.js** sirve VacInfo (`/(vacinfo)/*`) y VacDaTa (`/campo/*`).
- **Supabase** guarda todo y aplica la seguridad: cada consulta pasa por políticas RLS según la empresa, la finca y el rol del usuario.
- **Los cálculos del negocio** (fechas de palpación/secado/parto, alertas, saldo de insumos, indicadores) viven en **funciones SQL**, así web y celular ven los mismos números.
- **VacDaTa** guarda en el teléfono y sincroniza por la API con claves de idempotencia.

---

## 2. Tecnologías

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`), React 19, TypeScript |
| Estilos | Tailwind CSS v4, tipografías Fraunces + DM Sans, iconos lucide-react |
| Base de datos y auth | Supabase (Postgres 17, Auth, RLS), `@supabase/ssr`, `@supabase/supabase-js` |
| Validación | zod |
| Gráficas | recharts |
| Excel | exceljs (importador de planillas) |
| QR | qrcode |
| Offline | Service worker propio (`public/sw.js`), IndexedDB, Web App Manifest |
| Pruebas | vitest + scripts de QA con Chrome sin ventana (CDP) |
| Hosting | Vercel (app) + Supabase Cloud (datos) |

---

## 3. Estructura del repositorio

```
.
├── README.md
├── docs/
│   ├── PLAN.md                 # diagnóstico, modelo de negocio y datos, fases
│   ├── PLAN_FASE2.md           # plan y estado de la fase 2
│   └── FUNCIONALIDADES.md      # resumen no técnico de funciones
└── app/                        # aplicación Next.js (Root Directory en Vercel)
    ├── public/
    │   ├── sw.js               # service worker de VacDaTa
    │   └── manifest.webmanifest
    ├── scripts/qa/             # capturas, tiempos y pruebas funcionales
    ├── supabase/
    │   ├── config.toml         # stack local (puertos 553xx)
    │   ├── migrations/         # 9 migraciones (esquema, RLS, funciones)
    │   ├── seed.sql            # planilla real de Finca Toneles
    │   ├── seed_datos.sql      # usuarios demo, catálogos y registros de ejemplo
    │   ├── seed_fase2.sql      # inventario, levante, potreros, invitación, consumo automático
    │   └── seed_produccion.sql # solo catálogos (sin datos demo)
    └── src/
        ├── proxy.ts            # protege rutas y refresca la sesión
        ├── app/
        │   ├── (vacinfo)/      # web: fincas, animales, bienes, informes, indicadores,
        │   │                   #      calendario, inventario, equipo, mensajes, importar
        │   ├── campo/          # VacDaTa: registrar, mensajes, aprendizaje, comentario
        │   ├── api/campo/      # catálogo, sincronizar, mensajes (offline)
        │   ├── login/ registro/ unirse/
        ├── components/         # UI por módulo (fincas, informes, offline, potreros, …)
        └── lib/
            ├── supabase/       # clientes servidor y navegador
            ├── offline/        # IndexedDB, cola, esquemas y lógica de sincronización
            ├── importador/     # lectura y combinación de planillas Excel
            ├── finanzas.ts     # modelo contable (probado contra el PDF del consultor)
            ├── sesion.ts       # sesión, rol, empresa y fincas permitidas
            ├── permisos.ts     # soloLectura / puedeRegistrar
            └── database.types.ts
```

---

## 4. Roles y permisos

```mermaid
flowchart TB
    U(("Usuario")) --> L["/login<br/>correo o usuario + PIN"]
    L --> R{"¿Rol?"}
    R -- "propietario · administrador" --> G["VacInfo completo<br/>crear · editar · borrar"]
    R -- "veterinario" --> V["VacInfo<br/>ver y registrar eventos"]
    R -- "consultor" --> C["VacInfo<br/>solo lectura"]
    R -- "mayordomo · trabajador" --> D["VacDaTa<br/>registrar con o sin señal"]
    C -. "si entra a /campo" .-> X["redirige a VacInfo"]
```

| Acción | Propietario | Administrador | Veterinario | Consultor | Mayordomo / Trabajador |
|---|:-:|:-:|:-:|:-:|:-:|
| Ver fincas, fichas, informes, indicadores | ✅ | ✅ | ✅ | ✅ | vía VacDaTa |
| Registrar eventos (ordeño, parto, salud…) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Corregir o borrar registros | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crear/editar fincas, costos, catálogo de insumos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Importar Excel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invitar y manejar el equipo | ✅ | ✅ (excepto propietarios) | ❌ | ❌ | ❌ |
| Nombrar o quitar propietarios | ✅ | ❌ | ❌ | ❌ | ❌ |

- La restricción se aplica **en la base de datos** (RLS con `puede_ver_finca`, `puede_registrar_finca`, `puede_gestionar_finca`, …) y además se ocultan los botones en la interfaz.
- `miembros.fincas` limita a una persona a ciertas fincas (`null` = todas).
- Un trigger protege a los propietarios: la empresa siempre conserva al menos uno.

---

## 5. VacInfo (web)

```mermaid
flowchart LR
    I["/ Inicio"] --> F["/fincas"]
    I --> INF["/informes"]
    I --> M["/mensajes"]
    F --> FD["/fincas/:id<br/>animales · alertas · bienes · árbol · historial"]
    FD --> LV["/fincas/:id/levante"]
    FD --> PT["/fincas/:id/potreros"]
    FD --> CO["/fincas/:id/costos"]
    FD --> AN["/animales/:id<br/>ficha + QR"]
    FD --> BI["/bienes/:id"]
    INF --> OP["Operativo"]
    INF --> AD["Administrativo · 20 registros ICA"]
    INF --> CT["Contable"]
    I --> IND["/indicadores"]
    I --> CAL["/calendario"]
    I --> INV["/inventario"]
    I --> EQ["/equipo"]
    F --> IMP["/importar"]
```

| Módulo | Ruta | Descripción |
|---|---|---|
| Inicio | `/` | Resumen por finca: litros del día, vacas en ordeño, alertas altas |
| Fincas | `/fincas`, `/fincas/:id` | Resumen del hato, estado reproductivo por vaca, alertas, bienes, árbol de elementos, historial, fecha de corte |
| Ficha de animal | `/animales/:id` | Datos, QR imprimible, producción (60 días), reproducción, sanidad, crecimiento |
| Nuevo ser vivo | `/animales/nuevo` | Categoría (especie derivada), adquisición, madre de la finca, padre desde lista de toros |
| Bienes | `/bienes/:id` | Equipos con garantía, recordatorio, mantenimientos y QR |
| Levante | `/fincas/:id/levante` | Terneras y novillas: pesajes, destete, ganancia diaria, listas para servicio |
| Potreros | `/fincas/:id/potreros` | Mapa por estado, rotación de grupos, bloqueo por días de retiro, siguiente potrero sugerido |
| Costos | `/fincas/:id/costos` | Parámetros mensuales con vista previa y semáforo de rentabilidad |
| Informes | `/informes?tab=` | Operativo (planilla viva), Administrativo (20 registros ICA), Contable (costo por litro, equilibrio, flujo de caja) |
| Indicadores | `/indicadores` | Litros/día, litros/vaca, % preñez, concepción, días abiertos, costo por litro, mes a mes |
| Calendario | `/calendario` | Realizado, programado, vencido y **eventos agendados por el equipo** |
| Inventario | `/inventario` | Saldo por insumo, días que alcanza, mínimos, catálogo y **consumo automático** |
| Mensajes | `/mensajes` | Alertas automáticas, comentarios de VacDaTa y mensajes al equipo |
| Equipo | `/equipo` | Miembros, roles, fincas permitidas, invitaciones con código/enlace/QR |
| Importar | `/importar` | Carga de planillas quincenales en Excel, sin duplicar |

---

## 6. VacDaTa y el modo sin señal

### 6.1 Rutas

| Ruta | Descripción |
|---|---|
| `/campo` | Menú: **Registrar**, Mensajes (con no leídos), Aprendizaje, Comentario |
| `/campo/registrar` | Flujo único con o sin señal: Animal · Ordeño por lista · Finca · Pendientes |
| `/campo/mensajes` | Mensajes del administrador, legibles sin señal |
| `/campo/aprendizaje` | Manual del trabajador (texto), ciclo reproductivo, plan sanitario |
| `/campo/comentario` | Novedades al administrador con urgencia |
| `/campo/rapido`, `/campo/animal/:id`, `/campo/finca` | Rutas antiguas que redirigen a `/campo/registrar` |

### 6.2 Cómo funciona sin señal

```mermaid
sequenceDiagram
    autonumber
    actor J as Trabajador
    participant App as VacDaTa (navegador)
    participant DB as IndexedDB
    participant API as /api/campo/sincronizar
    participant PG as Supabase Postgres

    Note over J,App: Con señal (una vez al día)
    App->>API: GET /api/campo/catalogo?finca=
    API->>PG: animales + estado_reproductivo, potreros, insumos, toros, mensajes
    PG-->>App: catálogo de la finca
    App->>DB: guarda catálogo

    Note over J,App: Sin señal (modo avión)
    J->>App: busca vaca / escanea chapeta y registra
    App->>DB: agrega a la cola {cliente_id, accion, datos}
    App-->>J: "Guardado en el teléfono"

    Note over App,PG: Vuelve la señal (online, foco, cada 60 s, Background Sync)
    App->>API: POST registros[]
    loop por cada registro
        API->>PG: insert sincronizaciones(cliente_id)
        alt cliente_id nuevo
            API->>PG: valida (zod) e inserta el evento (RLS)
            API-->>App: ok
        else ya procesado
            API-->>App: duplicado
        else error de validación o permiso
            API->>PG: libera cliente_id
            API-->>App: error (se ve en Pendientes)
        end
    end
    App->>DB: quita de la cola lo enviado
```

### 6.3 Acciones que se guardan sin señal

| Grupo | Acciones (`lib/offline/tipos.ts`) |
|---|---|
| Animal | `ordeno`, `ordeno_lista`, `servicio`, `palpacion`, `parto` (crea la cría con `registrar_parto`), `secado`, `salud`, `destete`, `baja` |
| Finca | `carro_tanque`, `consumo_diario`, `mantenimiento`, `aplicacion` (fumigación/abonos con potreros), `control_calidad` (agua y tanque), `movimiento_insumo`, `visita`, `rotacion` |
| Legado | `pesaje` (ya no se muestra; se acepta para colas antiguas) |

### 6.4 Piezas

| Pieza | Archivo |
|---|---|
| Service worker (`vacdata-shell-v2`, `vacdata-estaticos-v2`) | `app/public/sw.js` |
| Manifest (start_url `/campo/registrar`) | `app/public/manifest.webmanifest` |
| IndexedDB y cola | `app/src/lib/offline/idb.ts`, `cliente.ts` |
| Validación y guardado en servidor | `app/src/lib/offline/esquemas.ts`, `servidor.ts` |
| API | `app/src/app/api/campo/{catalogo,sincronizar,mensajes}/route.ts` |
| Interfaz | `app/src/components/offline/*` |

> Guía no técnica para probarlo en la finca: se entrega como PDF aparte (no se versiona porque incluye credenciales).

---

## 7. Registro de empresas e invitaciones

```mermaid
flowchart TB
    subgraph Empresa["Nueva empresa · /registro"]
        A1["1. Cuenta<br/>correo + contraseña"] --> A2["2. Empresa<br/>crear_organizacion()"]
        A2 --> A3["3. Primera finca<br/>+ potreros"]
        A3 --> A4["4. ¡Listo!<br/>prueba 30 días"]
        A4 --> A5["Importar Excel · Invitar equipo · Ver finca"]
    end

    subgraph Equipo["Trabajador · /unirse?codigo="]
        B1["Administrador crea código<br/>rol · finca · usos · vence"] --> B2["Comparte código, enlace o QR"]
        B2 --> B3["ver_invitacion()"]
        B3 --> B4["Nombre + usuario + PIN<br/>usuario@campo.vacinfo.app"]
        B4 --> B5["aceptar_invitacion()"]
        B5 --> B6["Entra a VacDaTa"]
    end
```

- Los trabajadores **no necesitan correo**: el usuario se convierte en `<usuario>@campo.vacinfo.app` y la confirmación de correo está desactivada en Auth.
- Un usuario pertenece a **una sola empresa**. Los códigos de invitación evitan caracteres que se confunden (0/O, 1/I).

---

## 8. Reglas del negocio

### 8.1 Ciclo reproductivo

```mermaid
stateDiagram-v2
    [*] --> Novilla
    Novilla --> Servida: servicio (monta o inseminación)
    EnOrdeno: En ordeño
    Parto --> EnOrdeno
    EnOrdeno --> Servida: servicio
    EnOrdeno --> Mora: más de 40 días sin servicio
    Mora --> Servida: servicio
    Servida --> Palpacion: servicio + 33 días
    Palpacion --> Prenada: preñada
    Palpacion --> Servida: vacía → nuevo servicio
    Prenada --> Seca: secar a servicio + 210 días
    Seca --> Parto: parto esperado servicio + 275 días
    Parto --> [*]
```

Se calcula en `estado_reproductivo(finca, corte)`. La **fecha de corte** por defecto es la del último ordeño registrado (`lib/datos.ts › corteDeFinca`).

### 8.2 Alertas automáticas (`alertas_finca`)

| Tipo | Regla | Prioridad |
|---|---|---|
| Palpar | servicio + 33 días sin palpación | Media |
| Secar | preñada y en ordeño a servicio + 210 días | Alta |
| Parto | parto esperado dentro del horizonte | Alta |
| Mora de preñez | en ordeño más de 40 días sin servicio (> 60 alta) | Media / Alta |
| Retiro de leche | tratamiento con días de retiro vigentes | Alta |
| Vacuna | próxima dosis registrada | Media |
| Destete | cría que cumplió `fincas.dias_destete` | Media |
| Novilla lista | edad ≥ `edad_servicio_meses` y peso ≥ `peso_servicio_kg` | Media |
| Insumo | alcanza < 7 días o bajo el mínimo (agotado = alta) | Media / Alta |
| Evento agendado | `eventos_programados` pendientes en el horizonte | Media |

### 8.3 Inventario y consumo automático

```mermaid
flowchart LR
    ING["Ingresos<br/>movimientos_insumos"] --> S["saldo_insumos()"]
    SAL["Salidas<br/>movimientos_insumos"] --> S
    CD["Consumo diario en kg<br/>consumos_diarios ÷ contenido"] --> S
    CP["Consumo automático<br/>consumos_programados"] --> S
    AD["animales_por_dia()<br/>vacas en ordeño · secas · levante"] --> CP
    S --> R["saldo · consumo/día · días que alcanza · estado"]
    R --> AL["Alerta de insumo"]
```

Reglas de consumo automático: **fijo** (cantidad por día, mes o año) o **por animal** (cantidad × animales del grupo de cada día), opcionalmente en kg.

### 8.4 Importador de Excel

```mermaid
flowchart LR
    X["Libro .xlsx<br/>hojas quincenales"] --> P["leer.ts<br/>columnas por título"]
    P --> C["combinar.ts<br/>vaca = chapeta + nombre<br/>eventos por fecha"]
    C --> V["Vista previa<br/>nuevos · existentes · advertencias"]
    V --> A["aplicar.ts<br/>inserta sin duplicar"]
    A --> LOG["importaciones"]
```

### 8.5 Informe contable

`lib/finanzas.ts › calcularInforme(parametros)` reproduce el modelo del consultor: ingresos por leche, costos por categoría, utilidad y margen con semáforo (rentable ≥ 8 %, ajustada ≥ 3 %), costo y utilidad por litro, punto de equilibrio en litros, valorización de levante y flujo de caja. Está probado contra el PDF original (`src/lib/__tests__/finanzas.test.ts`).

---

## 9. Modelo de datos

```mermaid
erDiagram
    organizaciones ||--o{ miembros : tiene
    organizaciones ||--o{ fincas : tiene
    organizaciones ||--o{ insumos : catalogo
    organizaciones ||--o{ invitaciones : emite
    organizaciones ||--o{ mensajes : ""
    organizaciones ||--o{ comentarios : ""
    fincas ||--o{ animales : ""
    fincas ||--o{ potreros : ""
    fincas ||--o{ bienes : ""
    fincas ||--o{ parametros_costos : "por mes"
    fincas ||--o{ movimientos_insumos : ""
    fincas ||--o{ consumos_diarios : ""
    fincas ||--o{ consumos_programados : ""
    fincas ||--o{ recolecciones_leche : ""
    fincas ||--o{ aplicaciones_campo : ""
    fincas ||--o{ controles_calidad : ""
    fincas ||--o{ mantenimientos : ""
    fincas ||--o{ visitas : ""
    fincas ||--o{ eventos_programados : ""
    fincas ||--o{ importaciones : ""
    potreros ||--o{ rotaciones_potrero : ""
    animales ||--o{ ordenos : ""
    animales ||--o{ servicios : ""
    animales ||--o{ palpaciones : ""
    animales ||--o{ partos : madre
    animales ||--o{ secados : ""
    animales ||--o{ eventos_sanitarios : ""
    animales ||--o{ bajas : ""
    animales ||--o{ pesajes : ""
    insumos ||--o{ consumos_programados : ""
    bienes ||--o{ mantenimientos : ""
```

Tablas de apoyo: `perfiles`, `sincronizaciones` (idempotencia offline), `tareas_manual`, `plan_sanitario`.
Toda tabla de eventos guarda `registrado_por` y `registrado_en`.

---

## 10. Base de datos: migraciones y funciones

| Migración | Contenido |
|---|---|
| `20260912000001_esquema.sql` | Tipos, organizaciones, miembros, fincas, animales y eventos |
| `20260912000002_seguridad_y_calculos.sql` | RLS base, `estado_reproductivo`, `resumen_finca`, `alertas_finca` |
| `20260912000003_permisos.sql` | Privilegios del rol `authenticated` |
| `20260912000004_fase2.sql` | Importaciones, sincronizaciones, invitaciones, pesajes, potreros, inventario, indicadores, calendario, levante |
| `20260912000005_destete.sql` | `registrar_destete` |
| `20260912000006_endurecer.sql` | Protección de propietarios, códigos legibles, `registrar_parto` |
| `20260912000007_liberar_sincronizacion.sql` | Política para liberar marcas de sincronización |
| `20260912000008_catalogos.sql` | Manual del trabajador y plan sanitario |
| `20260913000009_ajustes.sql` | Consultor solo lectura, eventos programados, consumo automático, rendimiento, índices, `aplicar_baja` security definer |

**Funciones principales:** `estado_reproductivo`, `resumen_finca`, `alertas_finca`, `eventos_calendario`, `indicadores_mensuales`, `levante_finca`, `estado_potreros`, `saldo_insumos`, `animales_por_dia`, `ultimo_ordeno`, `registrar_parto`, `registrar_destete`, `crear_organizacion`, `ver_invitacion`, `aceptar_invitacion`.
**Ayudantes de RLS:** `es_miembro`, `es_gestor`, `puede_ver_finca`, `puede_ver_animal`, `puede_registrar_finca`, `puede_registrar_animal`, `puede_registrar_organizacion`, `puede_gestionar_finca`.

---

## 11. Desarrollo local

Requisitos: Docker, Node 22+, pnpm, Supabase CLI, Google Chrome (solo para scripts de QA).

```bash
cd app
pnpm install
supabase start        # Postgres + Auth + Studio en Docker
pnpm dev              # http://localhost:3000
```

| Servicio | Dirección |
|---|---|
| App | http://localhost:3000 |
| API Supabase | http://127.0.0.1:55321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:55322/postgres` |
| Studio | http://127.0.0.1:55323 |

Variables (`app/.env.local`, ver `app/.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<llave Publishable de `supabase status`>
```

Comandos útiles:

```bash
supabase db reset                 # recrea la base local con migraciones y semillas
supabase migration up --local     # aplica migraciones nuevas sin borrar datos
pnpm exec next typegen            # tipos de rutas (PageProps)
pnpm exec tsc --noEmit && pnpm lint && pnpm test
```

Regenerar tipos de la base local:

```bash
docker exec supabase_pg_meta_vacinfo node -e "fetch('http://localhost:8080/generators/typescript?included_schemas=public').then(r=>r.text()).then(t=>process.stdout.write(t))" > src/lib/database.types.ts
```

**Cuentas demo locales** (contraseña `vacinfo123`, definidas en `supabase/seed_datos.sql`): `gustavo@vacinfo.local` (administrador), `propietario@vacinfo.local`, `consultor@vacinfo.local`, `nelson@vacinfo.local` (mayordomo), `jhon@vacinfo.local` (trabajador). Invitación demo: `TONELE`.

**Datos semilla:** planilla real de Finca Toneles (corte 30/04/2026), parámetros del informe contable, y datos de demostración (ordeños recientes, inventario, levante, potreros, consumo automático).

---

## 12. Pruebas y control de calidad

| Prueba | Comando | Qué cubre |
|---|---|---|
| Unitarias | `pnpm test` | Modelo contable contra el PDF, importador de Excel |
| Integración offline | `VACDATA_INTEGRACION=1 pnpm exec vitest run src/lib/offline` | Todas las acciones sin señal, enviadas dos veces (idempotencia), limpieza de datos |
| Carga del histórico | `IMPORTAR_TONELES=1 pnpm exec vitest run scripts/importar-toneles.test.ts` | Importa el Excel real y verifica que no duplica |
| Capturas y tiempos | `node scripts/qa/capturar.mjs <antes\|despues> http://localhost:3100` | 14 capturas por rol y tiempos de 11 pantallas (build de producción) |
| Funcionales | `node scripts/qa/pruebas.mjs http://localhost:3100` | 31 pruebas: permisos, calendario, consumo automático, mensajes, registro unificado, formularios |

```mermaid
flowchart LR
    B["pnpm build && pnpm start -p 3100"] --> C1["capturar.mjs antes"]
    C1 --> CH["cambios"]
    CH --> B2["build nuevo"]
    B2 --> C2["capturar.mjs despues"]
    C2 --> PR["pruebas.mjs"]
    PR --> INF["informe antes/después"]
```

Los scripts de QA abren sesión con las cuentas demo **locales** (`scripts/qa/sesion-local.mjs`).

---

## 13. Despliegue

```mermaid
flowchart LR
    DEV["Cambios en local<br/>tsc · lint · test"] --> MIG{"¿Migraciones nuevas?"}
    MIG -- sí --> PUSHDB["cd app<br/>supabase db push"]
    MIG -- no --> GIT
    PUSHDB --> GIT["git push origin main"]
    GIT --> VER["Vercel construye app/"]
    VER --> PROD["Producción"]
```

> Aplica **primero** las migraciones en Supabase Cloud y **después** sube el código: Vercel despliega apenas llega el push.

**Supabase Cloud**

```bash
cd app
supabase login
supabase link --project-ref <ref>
supabase db push
```

- En Auth: **desactivar “Confirm email”** (usuarios con PIN), `site_url` y redirect URLs con el dominio de Vercel, contraseña mínima 6.
- No correr las semillas de demo en producción; los catálogos llegan con la migración `…08_catalogos.sql`.

**Vercel**

| Ajuste | Valor |
|---|---|
| Root Directory | `app` |
| Framework | Next.js |
| Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

---

## 14. Seguridad

- **RLS en todas las tablas**: nadie ve datos de otra empresa; el acceso por finca respeta `miembros.fincas`.
- **Consultor de solo lectura** a nivel de base de datos, acciones y rutas (`/campo` lo redirige; la API de sincronización responde 403).
- **Funciones `security definer`** solo donde hace falta (ayudantes de RLS, `registrar_parto`, `registrar_destete`, `aplicar_baja`, invitaciones) y con verificación de permisos interna.
- **Idempotencia offline** con `sincronizaciones(cliente_id)`: reintentar nunca duplica.
- **Auditoría**: cada evento guarda quién y cuándo lo registró.
- **Credenciales**: `.env*` y `entregables/` están en `.gitignore`. La llave publicable es pública por diseño; la secreta nunca va al cliente.

### Rate limiting

Implementado en Postgres (sin servicios externos ni variables nuevas): tabla `limites_uso` (claves en sha256, sin acceso directo) y función `consumir_limite()` (`20260914000010_rate_limit.sql`). El ayudante `src/lib/limites.ts` falla en abierto si la base no responde.

```mermaid
flowchart LR
    R["Petición"] --> L["limitar(clave, regla)"]
    L --> F["consumir_limite()<br/>ventana fija por clave"]
    F -->|permitido| OK["Continúa"]
    F -->|excedido| NO["429 + Retry-After<br/>o mensaje en el formulario"]
    F -. error de la base .-> OK
```

| Dónde | Clave | Límite |
|---|---|---|
| Login | IP | 30 intentos / 15 min |
| Login | cuenta (solo fallos) | 5 / 15 min, luego bloqueo 15 min; un acceso correcto reinicia |
| Registro y cuenta nueva por invitación | IP | 5 / hora |
| Consultar código de invitación | IP | 20 / 15 min |
| Aceptar invitación | usuario e IP | 10 / hora |
| Crear empresa | usuario | 3 / día |
| `/api/campo/sincronizar` | usuario | 60 / min, cuerpo ≤ 1 MB (413), ≤ 100 registros |
| `/api/campo/catalogo` · `/api/campo/mensajes` | usuario | 20 / min · 60 / min |
| Importar Excel | usuario | 10 / hora |

VacDaTa trata el 429 como “reintentar más tarde”: los registros siguen pendientes y respeta `Retry-After`.

**Supabase Auth en la nube:** como el login se hace desde los servidores de Vercel, los límites de Auth por IP se comparten entre todos los usuarios; se subieron a 1.800 renovaciones/5 min y 300 registros/verificaciones/5 min. La protección fina por persona la da la capa propia. Siguiente paso: `Sb-Forwarded-For`.

### Cabeceras de seguridad

`next.config.ts` envía `Content-Security-Policy` (sin orígenes externos salvo Supabase), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (cámara solo para “Escanear chapeta”) y `Strict-Transport-Security` en producción.

### Paginación

Todas las listas que crecen se paginan en la base con `.range()` y conteo exacto (`src/lib/paginacion.ts`, `src/components/paginacion.tsx`): fincas (12), animales de la finca (50), bienes, historial de servicios (varias tablas unidas), historial reproductivo y sanitario del animal, mantenimientos, movimientos y consumos de inventario, comentarios y mensajes, equipo e invitaciones, importaciones, rotaciones de potreros y grupos de levante. Cada lista usa su propio parámetro (`?pmov=`, `?pcom=`, …) y conserva los demás filtros.

Verificación: `node scripts/qa/seguridad.mjs http://localhost:3100` (cabeceras, 429, 413 y bloqueo de login).

---

## 15. Documentación relacionada y hoja de ruta

- [`docs/PLAN.md`](docs/PLAN.md) — diagnóstico de las fuentes (Excel, PDF, Canva), modelo de negocio y fases.
- [`docs/PLAN_FASE2.md`](docs/PLAN_FASE2.md) — importador, offline, inventario, equipo, indicadores, calendario, levante, potreros.
- [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) — resumen no técnico.

**Próximos pasos**

- Probar el modo sin señal en celulares reales en la sala de ordeño.
- Lector RFID de chapetas ICA (bastón Bluetooth en modo teclado) y etiquetas NFC para tanque, equipos y potreros.
- Alertas por WhatsApp, exportar informes a PDF, impresión masiva de QR.
- Planes y cobro, comparación entre fincas, pago por calidad de leche, nómina.
