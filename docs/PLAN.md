# VacInfo + VacDaTa — Plan unificado

> Fuentes analizadas: 7 carpetas de OneDrive (Excel, PDF, fotos de planillas) y 2 prototipos de Canva Code
> ("Interfaz VacInfo" y "VacDaTa – Menú y navegación"). Fecha: 2026-09-12.

---

## 1. Qué hay hoy (diagnóstico)

| Fuente | Qué es | Qué nos dice |
|---|---|---|
| `FINCA TONELES INFORME OPERATIVO (24 PLA TONELES).xlsx` | 50 hojas quincenales (15/06/24 → 30/04/26). Una fila por vaca | **El corazón operativo**: chapeta, nombre, parto anterior, fecha crío, días en ordeño, mora de preñez (>40 días), servicio (toro, raza, IA/monta), palpación (33 días), preñada, secar (servicio + 210 d), cría (secado + 65 d), leche AM/PM, mastitis por cuarto (TDD, TDI, TTD, TTI), cojera, fiebre, entamborada, sexo cría. Resumen: vacas preñadas/servidas/vacías/horras, inventario de concentrados y abonos, personal, contrato EPM, tanque y ruta Colanta |
| Fotos `INFORME OPERATIVO (Datos Manuales).jpeg` | La misma planilla impresa y llenada a mano en la finca | Confirma el flujo real: se imprime, se llena con esfero (leche de la tarde en rojo), y alguien la transcribe al Excel |
| `INFORME ADMINISTRATIVO (Cuadro Finca)` + `PLANILLA INFORME ADMINISTRATIVO.xlsx` | 20 registros tipo bitácora (formato ICA) | Ingreso/salida de insumos, leche recogida (placa, conductor), visitantes, fumigación, abonada/encalada, pH y cloro del agua, mantenimiento equipo de ordeño y cercas, tratamientos (lote, registro ICA, dosis, vía, días de retiro, veterinario con T.P.), palpación, inseminación, crías y calostro, secado, ventas/retiros, muertes, temperatura del tanque, veneno mosca/roedores, consumo diario de concentrado y sal |
| `MANEJO FINANZAS (PII 2026).xlsx` + PDFs `INFORME CONTABLE` (Finca de prueba y Amarilla) | Modelo de costos del consultor **Juan Carlos Patiño** | Parámetros (precios de insumos, consumo g/animal/día, nómina con prestaciones colombianas, fijos) → costo diario/mensual por 15 categorías → utilidad, costo por litro, punto de equilibrio, valorización de terneras/novillas, flujo de caja y semáforo (**Rentable ≥8% / Ajustada ≥3% / En riesgo**). La finca de prueba da **1% de margen: EN RIESGO** |
| `HOJA INFORMATIVA SER VIVO / FINCA / BIEN O SERVICIO.xlsx` | Especificación funcional de las "fichas" | Ficha del animal (clínica, sanitaria, producción, reproducción, parientes), ficha de finca (historial de servicios + inventario), ficha de bien (garantía, recordatorio). Regla: **todo registro guarda fecha y usuario** |
| `INFORME OPERATIVO.xlsx` (carpeta 6) | Mockup del informe operativo nuevo | Columnas unificadas: identificación, medidas de leche, enfermedades, tratamientos, reproducción, filtro "desde/hasta" |
| `MANUAL TRABAJADOR (cargo 120525).pdf` | 45 tareas (23 diarias, 22 frecuentes) | Contenido para el módulo **Aprendizaje** y para checklists |
| `FLUJOGRAMA TAREAS OPERATIVAS (Flujograma21).xlsx` | Flujogramas (dibujos) + plan de vacunación preventiva + tabla de gestación + clasificación de residuos + prueba de mastitis cada 7 días | Reglas de negocio para alertas automáticas |
| Canva **VacInfo** (desktop) | Inicio → Gestionar fincas / Ver informes / Mensajes | Fichas (ser vivo, finca, bien), árbol de elementos, parámetros de costos, eventos, informes operativo/administrativo/contable con filtro de fechas |
| Canva **VacDaTa** (móvil) | Registrar datos (QR / código / registros), Aprendizaje (manual, flujograma), Comentario (urgencia) | Registros: mantenimiento, fumigación, carro tanque, salud (vacunas, enfermedad, tratamientos, muerte, cría, reproducción), equipos, otro; elegir finca (Toneles / Amarillas) |

Contexto del negocio detectado: empresa con **~6 fincas** (hoja `OTROS`: nómina y arriendos repartidos entre 6), lecheras en Antioquia, proveedoras de **Colanta** (código asociado, tanque, ruta),
asesoradas por **Omega Asesores SAS**. Pago por calidad: bonificación/deducción por aseo (UFC/RCS). Personal: administrador, mayordomo, supernumerario.

---

## 2. Modelo de negocio

**Problema.** La información vive en papel → Excel quincenal transcrito a mano → un consultor arma el informe contable. Resultado: datos tardíos,
errores (chapetas duplicadas, fórmulas rotas `#¡DIV/0!`), cero alertas y márgenes de 1–6% sin visibilidad diaria.
"No se trata de producir más leche, se trata de ganar más dinero con la leche que se produce."

**Solución.** Una plataforma con dos caras sobre la misma base de datos:

- **VacDaTa** (móvil, trabajadores/mayordomo): registrar en 3 toques escaneando la chapeta (QR) o escribiendo el código. Reemplaza las planillas.
- **VacInfo** (web, dueño/administrador/consultor/veterinario): fincas, fichas, informes automáticos, costos y alertas.

**Segmentos.** (1) Empresas ganaderas con varias fincas (cliente inicial: las fincas Toneles, Amarilla…), (2) fincas lecheras medianas (20–100 vacas) proveedoras de cooperativas,
(3) consultores/asesores técnicos que atienden varias fincas (canal de distribución).

**Propuesta de monetización (propuesta, a validar):** SaaS por finca/mes por rangos de vacas; plan Consultor multi-cliente; el diagnóstico financiero
(modelo de Patiño) como módulo premium. La arquitectura es **multi-empresa desde el día 1** para que sirva igual como herramienta interna o como producto.

---

## 3. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Framework | Next.js (App Router, TypeScript, Tailwind) — un solo proyecto con dos áreas: `/(vacinfo)` desktop y `/campo` móvil (VacDaTa) |
| Backend | Supabase local en Docker (Postgres + Auth + Storage). Puertos **553xx** para no chocar con los stacks `jetpacker` y `yourhandoff` que ya corren |
| Seguridad | RLS en todas las tablas por pertenencia a la organización; roles `propietario`, `administrador`, `mayordomo`, `trabajador`, `veterinario`, `consultor` |
| Auditoría | Toda tabla de eventos tiene `registrado_por` y `registrado_en` (requisito explícito de las hojas informativas) |
| Diseño | Paleta y tipografías de los Canva: bosque `#173f2a`, lima `#d9ef9f`, crema `#fffdf7`, **Fraunces** + **DM Sans**, iconos Lucide |
| Cálculos | Reglas reproductivas en SQL (vistas) y modelo financiero en TypeScript puro (probado contra el PDF: margen 1,00%, costo/litro 2.168, equilibrio 856 L) |
| Identificación | Cada animal y bien tiene `codigo` único → QR imprimible para la chapeta |

---

## 4. Modelo de datos

```
organizaciones ─┬─ miembros (usuario, rol)
                └─ fincas ─┬─ potreros
                           ├─ animales ─┬─ ordenos (AM/PM, litros)
                           │            ├─ servicios (monta/IA, toro, raza, inseminador)
                           │            ├─ palpaciones (preñada/vacía, días)
                           │            ├─ partos (sexo cría, calostro, aborto, lavado) ──> crea animal cría
                           │            ├─ secados
                           │            ├─ eventos_sanitarios (enfermedad, tratamiento, vacuna, mastitis por cuarto,
                           │            │                      cojera, fiebre…; producto, lote, reg. ICA, dosis, vía, días retiro)
                           │            └─ bajas (venta, retiro, muerte + causa)
                           ├─ bienes (equipos, vehículos, herramientas; garantía, estado)
                           ├─ recolecciones_leche (litros, placa, conductor)
                           ├─ aplicaciones_campo (fumigación, fertilización, abonada, encalada, veneno mosca/roedores)
                           ├─ controles_calidad (pH/cloro agua, temperatura tanque)
                           ├─ mantenimientos (equipo ordeño, cercas/zanjas, general)
                           ├─ movimientos_insumos (ingreso/salida) ── insumos (catálogo con precio)
                           ├─ consumos_diarios (concentrado, sal)
                           ├─ visitas (ingreso de personas)
                           ├─ parametros_costos (por periodo: precios, consumos, nómina, fijos)
                           └─ comentarios / mensajes
tareas_manual, plan_sanitario (catálogos globales sembrados desde el manual y el flujograma)
```

**Vistas calculadas** (reemplazan las fórmulas del Excel):
- `v_estado_reproductivo`: días en ordeño, mora preñez (>40 d sin servicio), palpar el (servicio + 33), secar el (servicio + 210), parto esperado (secado + 65), días secas.
- `v_resumen_finca`: vacas en ordeño / horras / preñadas / servidas / vacías, litros del día, promedio por vaca.
- `v_retiros_activos`: animales con leche en retiro por tratamiento.

**Alertas automáticas:** palpar, secar, parto próximo, mora de preñez, retiro de leche vigente, vacuna próxima, prueba de mastitis cada 7 días, revisión de chapetas cada 15 días, medición de leche los días 15 y 30.

---

## 5. Pantallas

**VacInfo (web)**
1. Inicio (hero de Canva) → Fincas · Informes · Mensajes
2. Fincas: buscador, tarjeta con métricas (vacas, litros/día, % productivas, área) → Fichas · Parámetros de costos · Eventos · Árbol de elementos
3. Ficha de animal (general / clínica / producción / reproducción / parientes, QR), ficha de finca, ficha de bien
4. Informes con filtro desde/hasta:
   - **Operativo**: la matriz de Toneles viva (reproducción + leche + sanidad)
   - **Administrativo**: los 20 registros tipo ICA
   - **Contable**: modelo de Patiño (costos por categoría, costo/litro, punto de equilibrio, semáforo, flujo de caja)
5. Mensajes y notificaciones (alertas + comentarios de trabajadores)

**VacDaTa (móvil)**
1. Registrar datos → escanear QR / escribir código / registros de finca (mantenimiento, fumigación, carro tanque, salud, equipos, otro) → formulario corto
2. Aprendizaje → manual del trabajador (diarias/frecuentes) y flujograma
3. Comentario con urgencia (baja/media/alta) → llega a Mensajes de VacInfo

---

## 6. Decisiones del negocio (12/09/2026)

| Pregunta | Decisión | Impacto en el plan |
|---|---|---|
| Objetivo | **SaaS desde ya** | Registro público de empresas (onboarding: crear organización → primera finca → invitar equipo), planes por finca/vacas, límites por plan, página comercial |
| Conectividad en finca | **Intermitente o nula** | VacDaTa como PWA con cola local (IndexedDB) y sincronización al volver la señal; catálogo de animales cacheado por finca |
| Histórico Toneles | **Importar las 50 quincenas** | Importador que recorre todas las hojas y deduplica partos, servicios, palpaciones y secados por vaca → historial real |

## 7. Fases

| # | Entregable | Estado |
|---|---|---|
| F0 | Next.js + Supabase local en Docker, puertos propios, variables de entorno | en curso |
| F1 | Migraciones (esquema + RLS + vistas) y seed con datos reales de Toneles (43 vacas en ordeño + 8 horras de la hoja 30/04/26), manual y plan sanitario | |
| F2 | Auth (correo/contraseña), organización, roles, usuarios demo | |
| F3 | VacDaTa: registro por código/QR, formularios de eventos, comentarios, aprendizaje | |
| F4 | VacInfo: inicio, fincas, fichas, árbol de elementos | |
| F5 | Informes operativo y administrativo con filtro de fechas | |
| F6 | Parámetros de costos + informe contable (validado contra el PDF) | |
| F7 | Alertas y mensajes | |
| F8 | Importador del histórico (50 quincenas de Toneles) | |
| F9 | VacDaTa offline (PWA + cola de sincronización) | |
| F10 | SaaS: registro de empresas, invitaciones, planes y límites, landing | |
| F11 | Exportar informes a PDF, impresión masiva de QR | |
