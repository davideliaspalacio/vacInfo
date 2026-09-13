# Fase 2 — Plan de ejecución

Fecha: 12/09/2026. Alcance aprobado: features 10 a 18. Las marcadas ★ son prioridad máxima.
Criterio: nada depende de servicios de terceros (ni WhatsApp, ni SMS, ni pasarelas de pago).

| # | Feature | Qué entrega | Pantallas |
|---|---|---|---|
| ★10 | **Importar Excel de la finca** | Subir el libro de planillas quincenales (formato Toneles); se leen todas las hojas, se crean/actualizan las vacas y se cargan partos, servicios, palpaciones y secados sin duplicar. Vista previa antes de confirmar y bitácora de importaciones. Carga del histórico real de Toneles (50 quincenas). | VacInfo › Importar |
| ★11 | **Inventario con saldo** | Saldo por insumo = ingresos − salidas − consumo diario registrado. Consumo promedio, días que alcanza, mínimo configurable y alerta de insumo bajo/agotado. | VacInfo › Inventario |
| ★12 | **VacDaTa sin internet** | App instalable en el celular. Modo "Registro rápido" que funciona sin señal: vacas de la finca guardadas en el teléfono, registros en cola local y sincronización automática sin duplicados al volver la conexión. | VacDaTa › Registro rápido |
| 13 | **Invitar al equipo con código** | El administrador genera un código/enlace con rol y (opcional) finca. El trabajador se une con nombre, usuario y PIN (sin correo). Miembros pueden quedar limitados a una finca. | VacInfo › Equipo · /unirse |
| 14 | **Registro de empresas** | Asistente: cuenta → empresa → primera finca → siguientes pasos (importar Excel, invitar equipo). Periodo de prueba de 30 días registrado (sin cobro). | /registro |
| 15 | **Tablero de indicadores** | Mes a mes: litros/día, litros por vaca, vacas en ordeño, partos, servicios, tasa de concepción, % preñez del hato, días abiertos, leche recogida vs ordeñada y costo por litro. | VacInfo › Indicadores |
| 16 | **Calendario de la finca** | Mes en cuadrícula y en lista: lo realizado (partos, servicios, palpaciones, secados, sanidad, pesajes) y lo programado (palpar, secar, partos esperados, vacunas, fin de retiros, destetes). | VacInfo › Calendario |
| 17 | **Terneras y novillas** | Pesajes, destete, edad y ganancia diaria; estado (lactante, por destetar, levante, lista para servicio, servida) con reglas por finca (días de destete, edad y peso para servicio). Crear la ficha de la cría al registrar un parto. | Finca › Levante · VacDaTa (pesaje, destete) |
| 18 | **Potreros** | Rotación (entrada/salida de grupos), días de descanso, ocupación actual, última aplicación y bloqueo por días de retiro. Estado: ocupado, bloqueado, listo, descansando. | Finca › Potreros · VacDaTa (rotación) |

## Cómo se ejecuta

1. **Base de datos (una sola migración, coordinada):** tablas nuevas (importaciones, sincronizaciones, invitaciones, pesajes, rotaciones), reglas por finca, funciones de cálculo (saldo de insumos, indicadores, calendario, levante, potreros), alertas ampliadas, permisos y datos de demostración.
2. **Construcción en paralelo** (5 frentes con archivos separados):
   - A · Importador (10)
   - B · Offline (12)
   - C · Registro de empresas + equipo (13, 14)
   - D · Inventario + indicadores + calendario (11, 15, 16)
   - E · Levante + potreros (17, 18)
3. **Integración:** menú, pestañas de finca, tipos, verificación de compilación, lint, pruebas y recorrido en el navegador.

## Estado al 12/09/2026 — terminado

Verificación: compilación sin errores, lint limpio, 10 pruebas en verde (+ pruebas de integración opcionales), recorrido en navegador de todas las pantallas.

| # | Resultado |
|---|---|
| 10 | Histórico de Toneles importado: 46 quincenas (15/06/24–30/04/26), 21 vacas históricas (retiradas), 64 partos, 250 servicios, 84 palpaciones, 76 secados, 3.758 ordeños. Reimportar no duplica. 24 advertencias del Excel (chapetas repetidas, vacas duplicadas en una hoja, inseminador "TR" desconocido). |
| 11 | Inventario con saldo, días que alcanza, mínimos, catálogo y alertas de insumo bajo. |
| 12 | App instalable, service worker, catálogo de la finca en el teléfono, cola local, sincronización sin duplicados, ordeño por lista. Probado en servidor; falta prueba en un celular real sin señal. |
| 13 | Invitaciones con código/enlace/QR, usuario + PIN sin correo, acceso limitado por finca. |
| 14 | Registro de empresa en 4 pasos con prueba de 30 días. |
| 15 | Tablero mensual con 6 indicadores y costo por litro. |
| 16 | Calendario mensual con realizados, programados y vencidos. |
| 17 | Levante: pesajes, destete, ganancia diaria, listas para servicio; parto crea la cría en una sola operación. |
| 18 | Potreros: mapa por estado, rotación, bloqueo por retiro y sugerencia del siguiente potrero. |

Endurecimiento extra: propietario protegido en la base, una cuenta = una empresa, códigos sin caracteres confusos, novillas que paren pasan a vaca.

### Pendientes conocidos
- La tasa de concepción aparece en 100 % porque la planilla solo registra palpaciones positivas.
- Offline: el parto sin señal no crea la ficha de la cría; iPhone no tiene sincronización en segundo plano.
- No hay borrado de movimientos de inventario ni de potreros desde la pantalla.
- Revisar con la finca las chapetas repetidas y el inseminador "TR".

## Criterios de terminado
- Compila sin errores, lint limpio, pruebas en verde.
- Cada pantalla probada con los usuarios demo.
- Importación del histórico de Toneles verificada contra el Excel (sin duplicados al importar dos veces).
- Registro sin conexión probado: se registra offline, se sincroniza una sola vez.
