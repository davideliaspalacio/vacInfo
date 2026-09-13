# VacInfo · VacDaTa

Plataforma de gestión lechera: **VacInfo** (web para dueños, administradores y consultores) y **VacDaTa** (móvil para mayordomos y trabajadores), sobre una sola base Supabase.

Plan, modelo de negocio y modelo de datos: [docs/PLAN.md](docs/PLAN.md).

## Levantar en local

Requisitos: Docker, Node 22, pnpm, Supabase CLI.

```bash
cd app
pnpm install
supabase start        # Postgres + Auth + Studio en Docker (puertos 553xx)
pnpm dev              # http://localhost:3000
```

- Studio: http://127.0.0.1:55323 · API: http://127.0.0.1:55321 · DB: `postgresql://postgres:postgres@127.0.0.1:55322/postgres`
- Reiniciar la base con migraciones y datos semilla: `supabase db reset`
- Pruebas del modelo financiero: `pnpm test`

## Cuentas de demostración (contraseña `vacinfo123`)

| Correo | Rol | Entra a |
|---|---|---|
| gustavo@vacinfo.local | Administrador | VacInfo |
| propietario@vacinfo.local | Propietario | VacInfo |
| consultor@vacinfo.local | Consultor | VacInfo |
| nelson@vacinfo.local | Mayordomo | VacDaTa (`/campo`) |
| jhon@vacinfo.local | Trabajador | VacDaTa (`/campo`) |

Otras formas de entrar:

- **Crear una empresa nueva:** http://localhost:3000/registro
- **Unirse como trabajador con código:** http://localhost:3000/unirse?codigo=TONELE (Finca Toneles, rol trabajador; usuario + PIN, sin correo)
- **VacDaTa sin señal:** http://localhost:3000/campo/rapido (se puede instalar en el celular)

## Datos semilla

- **Reales** (planilla FINCA TONELES, corte 30/04/2026): 51 animales, partos, servicios, palpaciones y secados.
- **Del consultor**: parámetros de costos del informe contable de la finca de prueba (abril 2026).
- **De demostración**: ordeños de los últimos 14 días antes del corte (≈21 L/vaca/día), algunos registros administrativos,
  movimientos y consumos de insumos, terneras y terneronas con pesajes, rotación de potreros (mar–abr 2026) y la invitación `TONELE`.
- **Histórico real**: se carga desde VacInfo › Importar con el Excel de planillas quincenales.
  Los informes usan como fecha de corte la última fecha con ordeños si no hay datos de hoy.

## Estructura

```
app/
  supabase/migrations/   esquema, RLS y cálculos (estado reproductivo, resumen, alertas)
  supabase/seed*.sql     datos semilla
  src/app/(vacinfo)/     web: inicio, fincas, fichas, informes, mensajes
  src/app/campo/         VacDaTa: registrar por QR/código, aprendizaje, comentarios
  src/lib/finanzas.ts    modelo de costos del consultor (probado contra el PDF)
```
