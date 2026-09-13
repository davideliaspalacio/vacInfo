-- Usuarios demo (contraseña: vacinfo123), catálogos y registros de ejemplo.

-- ─────────────── Usuarios ───────────────
with u (id, email, nombre) as (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'propietario@vacinfo.local', 'Propietario Demo'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'gustavo@vacinfo.local', 'Gustavo López'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'nelson@vacinfo.local', 'Nelson'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'jhon@vacinfo.local', 'Jhon Alex José'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'consultor@vacinfo.local', 'Consultor financiero')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('vacinfo123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre_completo', nombre), now(), now(),
  '', '', '', ''
from u;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@vacinfo.local';

insert into miembros (organizacion_id, usuario_id, rol) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'propietario'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'administrador'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'mayordomo'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'trabajador'),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'consultor');

-- ─────────────── Potreros (24 cuadras) ───────────────
insert into potreros (finca_id, numero)
select '00000000-0000-4000-8000-000000000101', n from generate_series(1, 24) n;

-- ─────────────── Insumos (hojas INFORMACION, CONCE, VENE FER, MEDICA) ───────────────
insert into insumos (organizacion_id, nombre, categoria, unidad, contenido, precio) values
  ('00000000-0000-4000-8000-000000000001', 'Concentrado vacas leche', 'concentrado', 'bulto', 40, 75000),
  ('00000000-0000-4000-8000-000000000001', 'Concentrado preparto', 'concentrado', 'bulto', 40, 70000),
  ('00000000-0000-4000-8000-000000000001', 'Concentrado terneras', 'concentrado', 'bulto', 40, 75000),
  ('00000000-0000-4000-8000-000000000001', 'Sal mineralizada', 'sal', 'bulto', 40, 126000),
  ('00000000-0000-4000-8000-000000000001', 'Premex', 'mineral', 'bulto', 10, 102000),
  ('00000000-0000-4000-8000-000000000001', 'Colanta 34-8-8', 'abono', 'bulto', 50, 174000),
  ('00000000-0000-4000-8000-000000000001', 'Urea', 'abono', 'bulto', 50, 183000),
  ('00000000-0000-4000-8000-000000000001', 'Gallinaza', 'abono', 'bulto', 40, 26000),
  ('00000000-0000-4000-8000-000000000001', 'Cal agrícola', 'cal', 'bulto', 50, 26000),
  ('00000000-0000-4000-8000-000000000001', 'Insecticida plagas', 'veneno', 'litro', 1, 210000),
  ('00000000-0000-4000-8000-000000000001', 'Fungicida', 'veneno', 'litro', 1, 210000),
  ('00000000-0000-4000-8000-000000000001', 'Veneno mosco', 'veneno', 'litro', 1, 190000),
  ('00000000-0000-4000-8000-000000000001', 'Veneno garrapata', 'veneno', 'litro', 1, 180000),
  ('00000000-0000-4000-8000-000000000001', 'Sellador (Sellodine)', 'aseo', 'garrafa', 20, 275000),
  ('00000000-0000-4000-8000-000000000001', 'Ácido', 'aseo', 'garrafa', 20, 115000),
  ('00000000-0000-4000-8000-000000000001', 'Antibiótico', 'medicamento', 'frasco', 1, 150000),
  ('00000000-0000-4000-8000-000000000001', 'Pajilla de semen', 'semen', 'pajilla', 1, 45000);

-- ─────────────── Bienes ───────────────
insert into bienes (finca_id, codigo, nombre, tipo, marca, estado, descripcion, recordatorio) values
  ('00000000-0000-4000-8000-000000000101', 'TON-B1', 'Tanque de enfriamiento', 'equipo', 'Colanta #6696', 'bueno', 'Tanque de leche en comodato', 'Apagar y bajar breakers en la noche o con tormenta'),
  ('00000000-0000-4000-8000-000000000101', 'TON-B2', 'Equipo de ordeño', 'equipo', null, 'bueno', 'Sala de ordeño', 'Cambiar pezoneras cada 3 meses'),
  ('00000000-0000-4000-8000-000000000101', 'TON-B3', 'Bomba estercolero', 'maquinaria', null, 'mantenimiento', 'Regar tanque estercolero cada 2–3 días', 'Guardar en la casa después de usar'),
  ('00000000-0000-4000-8000-000000000101', 'TON-B4', 'Fumigadora de espalda', 'herramienta', null, 'bueno', 'Presión máxima 20 libras', null);

-- ─────────────── Registros de ejemplo (alrededor del corte 30/04/2026) ───────────────
insert into recolecciones_leche (finca_id, fecha, litros, placa, conductor, entregado_por) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-28', 1702, 'TLK-482', 'Carlos Ramírez', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', '2026-04-29', 1688, 'TLK-482', 'Carlos Ramírez', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', '2026-04-30', 1715, 'TLK-482', 'Carlos Ramírez', 'Jhon Alex José');

insert into controles_calidad (finca_id, fecha, tipo, jornada, grados, responsable) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-30', 'temperatura_tanque', 'am', 3.8, 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', '2026-04-30', 'temperatura_tanque', 'pm', 4.1, 'Jhon Alex José');
insert into controles_calidad (finca_id, fecha, tipo, muestra, ph, cloro, estado, responsable) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-27', 'agua', 'Tanque sala de ordeño', 7.2, 1.1, 'Apta', 'Nelson');

insert into aplicaciones_campo (finca_id, fecha, tipo, producto, cantidad, unidad, potreros, dias_retiro_pastoreo, personas) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-22', 'fumigacion', 'Insecticida plagas', 150, 'cc por caneca', '7, 8, 9', 8, 'Jhon Alex José'),
  ('00000000-0000-4000-8000-000000000101', '2026-04-25', 'abonada', 'Colanta 34-8-8', 3, 'bultos', '10, 11', 0, 'Jhon Alex José');

insert into mantenimientos (finca_id, fecha, tipo, detalle, materiales, responsable) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-20', 'cercas', 'Cambio de estacones quebrados potrero 5', '6 estacones, alambre', 'Nelson');

insert into movimientos_insumos (finca_id, producto, fecha, hora, tipo, cantidad, entrega, recibe) values
  ('00000000-0000-4000-8000-000000000101', 'Concentrado vacas leche', '2026-04-24', '09:30', 'ingreso', 40, 'Colanta', 'Nelson'),
  ('00000000-0000-4000-8000-000000000101', 'Colanta 34-8-8', '2026-04-24', '09:30', 'ingreso', 20, 'Colanta', 'Nelson');

insert into visitas (finca_id, fecha, hora_ingreso, nombre, empresa, motivo) values
  ('00000000-0000-4000-8000-000000000101', '2026-04-15', '08:00', 'Técnico Colanta', 'Colanta', 'Revisión del tanque de enfriamiento');

insert into eventos_sanitarios (animal_id, fecha, tipo, diagnostico, producto, dosis, via_administracion, dias_retiro, cuartos, estado, veterinario, operario)
select id, '2026-04-27', 'mastitis', 'Mastitis clínica', 'Antibiótico intramamario', '1 jeringa por cuarto', 'Intramamaria', 5, array['TDD'], 'en_tratamiento', 'C.G. (veterinario)', 'Nelson'
from animales where codigo = 'TON-2079';

insert into comentarios (organizacion_id, finca_id, mensaje, urgencia, registrado_por) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101',
   'La bomba del estercolero se está taqueando, toca revisarla antes del sábado.', 'alta', '10000000-0000-4000-8000-000000000004');

insert into mensajes (organizacion_id, remitente_id, destinatario_id, texto) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null,
   'Recuerden: medir la leche de cada vaca el 15 y el 30 y anotar partos, abortos y servicios de la quincena.');

-- ─────────────── Parámetros de costos (INFORME CONTABLE, finca de prueba) ───────────────
-- "caja": false = no sale como pago en el flujo de caja del mes (provisiones, prestaciones, arreglos de vías).
insert into parametros_costos (finca_id, periodo, datos) values (
  '00000000-0000-4000-8000-000000000101', '2026-04-01',
  $json${
    "precio_litro": 2190,
    "valorizacion_mensual_por_animal": 120000,
    "animales": { "vacas_produccion": 42, "vacas_horras": 8, "novillas": 8, "terneronas": 8, "terneras": 8, "toros": 0, "caballos": 0, "perros": 0, "otros": 0 },
    "litros_dia": { "venta": 830, "terneras": 32, "consumo_humano": 3 },
    "costos": [
      { "categoria": "Concentrados", "items": [
        { "nombre": "Concentrado vacas", "mes": 17145536 }, { "nombre": "Sales", "mes": 485625 },
        { "nombre": "Concentrado novillas - terneronas", "mes": 240000 }, { "nombre": "Concentrado horras", "mes": 225000 },
        { "nombre": "Concentrado terneras", "mes": 225000 }, { "nombre": "Minerales (Premex)", "mes": 128520 } ] },
      { "categoria": "Fertilizantes", "items": [
        { "nombre": "Abono - fertilizante químico", "mes": 10442880 }, { "nombre": "Fertilizante polvo", "mes": 528571 },
        { "nombre": "Fertilizante líquido", "mes": 507429 }, { "nombre": "Cales", "mes": 502164 },
        { "nombre": "Abonaza gallinaza", "mes": 461760 } ] },
      { "categoria": "Venenos", "items": [
        { "nombre": "Veneno plagas", "mes": 799200 }, { "nombre": "Veneno hongos", "mes": 799200 },
        { "nombre": "Veneno mosco", "mes": 200857 }, { "nombre": "Veneno garrapata", "mes": 95143 } ] },
      { "categoria": "Suministros de aseo", "items": [
        { "nombre": "Sellador", "mes": 154688 }, { "nombre": "Papel", "mes": 78000 }, { "nombre": "Desinfectante", "mes": 67500 },
        { "nombre": "Ácido", "mes": 64688 }, { "nombre": "Degraso", "mes": 57375 }, { "nombre": "Jabones", "mes": 54000 } ] },
      { "categoria": "Medicamentos", "items": [
        { "nombre": "Analgésico", "mes": 469198 }, { "nombre": "Antibióticos", "mes": 469198 }, { "nombre": "Vitaminas", "mes": 260665 },
        { "nombre": "Purgante", "mes": 218959 }, { "nombre": "Secantes", "mes": 155342 }, { "nombre": "Sueros", "mes": 113601 } ] },
      { "categoria": "Insumos equipo de ordeño", "items": [
        { "nombre": "Accesorios ordeño", "mes": 112500 }, { "nombre": "Pezoneras", "mes": 96164 }, { "nombre": "Aceite ordeño", "mes": 15000 } ] },
      { "categoria": "Pagos a terceros", "items": [
        { "nombre": "Electricidad", "mes": 1700000 }, { "nombre": "Impuesto predial", "mes": 450000 }, { "nombre": "Estacones", "mes": 117857 },
        { "nombre": "Zanjas", "mes": 98214 }, { "nombre": "Gasolina", "mes": 80000 }, { "nombre": "Acueducto", "mes": 30000 },
        { "nombre": "Pitas", "mes": 25548 }, { "nombre": "Arriendo", "mes": 0 } ] },
      { "categoria": "Nómina", "items": [
        { "nombre": "Salario mayordomo", "mes": 3000000 }, { "nombre": "Prestaciones mayordomo", "mes": 655200, "caja": false },
        { "nombre": "Seguridad social mayordomo", "mes": 1156320 }, { "nombre": "Salario empleado 1", "mes": 3400000 },
        { "nombre": "Prestaciones empleado 1", "mes": 742560, "caja": false }, { "nombre": "Seguridad social empleado 1", "mes": 1310496 } ] },
      { "categoria": "Transporte de leche", "items": [ { "nombre": "Transporte leche", "mes": 1608900 } ] },
      { "categoria": "Otros transportes", "items": [
        { "nombre": "Transporte concentrado", "mes": 607104 }, { "nombre": "Transporte abono", "mes": 177600 },
        { "nombre": "Transporte cales", "mes": 48285 }, { "nombre": "Transporte abonaza", "mes": 44400 } ] },
      { "categoria": "Varios", "items": [
        { "nombre": "Mantenimiento equipos", "mes": 100000 }, { "nombre": "Internet", "mes": 70000 }, { "nombre": "Celular", "mes": 70000 },
        { "nombre": "Overoles", "mes": 53333 }, { "nombre": "Arreglo vía interna", "mes": 50000, "caja": false },
        { "nombre": "Arreglo vía externa", "mes": 50000, "caja": false }, { "nombre": "Botas", "mes": 31333 } ] },
      { "categoria": "Reproducción (semen)", "items": [ { "nombre": "Semen pajilla", "mes": 248548 } ] },
      { "categoria": "Gastos administrativos", "items": [
        { "nombre": "Contador", "mes": 600000 }, { "nombre": "Veterinario", "mes": 180000 }, { "nombre": "Auxiliar general", "mes": 100000 } ] },
      { "categoria": "Préstamo inversión", "items": [ { "nombre": "Préstamo bancario inversión", "mes": 2500000 } ] },
      { "categoria": "Provisiones y mortales", "items": [
        { "nombre": "Mortales", "mes": 1500000, "caja": false }, { "nombre": "Imprevistos", "mes": 284153, "caja": false } ] }
    ]
  }$json$::jsonb
);

-- ─────────────── Plan sanitario preventivo (hoja PREVENTIVOS) ───────────────
insert into plan_sanitario (enfermedad, joven, adulto, observaciones) values
  ('Fiebre aftosa', 'A partir de los 6 meses, 2 veces al año', '2 veces al año', 'Sujeto a calendario oficial'),
  ('Estomatitis vesicular', '2 veces al año', '2 veces al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('IBR - DVB - PI3 - BRSV', 'Vacunar al 4.º mes, revacunar al 5.º', 'Una vez al año', null),
  ('Rabia', 'Entre 3 y 6 meses', 'Una vez al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('Carbón sintomático, edema maligno y clostridiosis', 'Vacunar al 4.º mes, revacunar al 5.º', 'Una vez al año', null),
  ('Botulismo', 'Vacunar al 6.º mes, revacunar al 7.º', 'Una vez al año', 'Zonas endémicas o en riesgo. Asesoría ICA'),
  ('Carbón bacteridiano (ántrax)', 'Vacunar a los 12 meses', 'Una vez al año', 'En zonas endémicas primovacunación desde los 6 meses'),
  ('Brucelosis', 'Hembras de 3 a 8 meses', 'Según ciclos de vacunación', 'Cepa RB-51 para no interferir con el diagnóstico'),
  ('Leptospirosis', 'Vacunar al 4.º mes, revacunar al 5.º', 'Cada 4 a 12 meses según prevalencia', null),
  ('Neumonía pasterelósica', 'Vacunar al 3.er mes, revacunar al 4.º', 'Una vez al año', 'Antes de destete, parto o transporte'),
  ('Desparasitación', 'Cada 4 meses', 'Cada 6 meses', 'Productos sin retiro para vacas de leche');

-- ─────────────── Manual del trabajador (cargo 120525) ───────────────
insert into tareas_manual (frecuencia, orden, descripcion) values
  ('diaria', 1, 'Hacer caso, escuchar, respetar e informar.'),
  ('diaria', 2, 'Si no conoce una actividad, no la invente: pregunte al administrador o a un compañero.'),
  ('diaria', 3, 'Para ingresar a laborar debe hacerse examen de ingreso general y de sicoactivos (lo paga la empresa).'),
  ('diaria', 4, 'Procurar que las vacas entren a comer pasto en las tardes, abriendo pastura una sola vez al día.'),
  ('diaria', 5, 'Ir al potrero por rieles o caminos, contar las vacas, abrir pastura, mover las aguas y encaminar las vacas despacio a la sala.'),
  ('diaria', 6, 'En la sala: cerrar puertas, desinfectar equipos, colocar filtro y cerrar llave del tanque, calentar agua para el lavado.'),
  ('diaria', 7, 'Ordeño: 1 kg de concentrado por cada 3 litros, limpiar y despuntar con tres chorros, secar tetas, colocar pezoneras, revisar que no quede leche y sellar.'),
  ('diaria', 8, 'Juagar y lavar el equipo de ordeño, la fosa y la sala en la mañana y en la tarde; lavar la sala de espera en la mañana.'),
  ('diaria', 9, 'Llevar leche a las terneras mañana y tarde, medio kilo de concentrado por animal, correr pasto y lavar el bebedero.'),
  ('diaria', 10, 'Medir la leche del tanque mañana y tarde, anotarla, entregar al carrotanque y anotar lo recogido.'),
  ('diaria', 11, 'Ir a los potreros mañana y tarde, contar las vacas, verificar el agua y que el potrero quede con cerca.'),
  ('diaria', 12, 'Regar el abono de lunes a sábado (mañana en invierno, tarde en verano), revolviendo bulto por bulto.'),
  ('diaria', 13, 'Cuidar las terneras de paso: un kilo de concentrado por animal, pastura, agua limpia todos los días.'),
  ('diaria', 14, 'Revisar que el tanque de leche enfríe; apagarlo y bajar los breakers en la noche o si va a tronar o llover.'),
  ('diaria', 15, 'Regar el tanque estercolero cada 2–3 días en verano (a diario en invierno); no dejar taquear la bomba y guardarla.'),
  ('diaria', 16, 'Fumigar lento una o dos veces por semana según indicación del agrónomo; la máquina a 20 libras de presión, no más.'),
  ('diaria', 17, 'Cuidar las novillas próximas a criar con 1–2 kg de concentrado preparto en las tardes.'),
  ('diaria', 18, 'Lavar el tanque de enfriamiento y utensilios después de que el carrotanque recoja la leche.'),
  ('diaria', 19, 'Verificar que las vacas que criaron expulsaron la placenta; si no, avisar al administrador para antibiótico.'),
  ('diaria', 20, 'Revisar las vacas horras dos veces por semana: sin mastitis y sanas hasta que críen.'),
  ('diaria', 21, 'Informar al administrador todo evento de vacas, terneras, compañeros, equipos, casa y vecinos.'),
  ('diaria', 22, 'Regar veneno cada 8 días en lomo y patas de vacas y terneras para evitar el mosco.'),
  ('frecuente', 1, 'Mantener limpios y sin huecos los caminos de ingreso de las vacas a la sala.'),
  ('frecuente', 2, 'Los días 15 y 30 medir la leche de cada vaca en la tarde y anotar partos, abortos, cojeras, fiebres, servicios, concentrado y abonos.'),
  ('frecuente', 3, 'Secar las vacas preñadas confirmadas a los 7 meses (palpar antes) o si dan menos de 5 litros; tratar mastitis antes de secar.'),
  ('frecuente', 4, 'Revisar cada 5 días ubres y estado corporal de las vacas horras que estén en otra finca.'),
  ('frecuente', 5, 'Revisar día por medio las vacas próximas a parir que estén en el paridero de otra finca.'),
  ('frecuente', 6, 'Al parto: dar obligatoriamente 3 litros de calostro al ternero, calcio oral y en vena a la vaca, yodo en el ombligo; mover a las 24 horas.'),
  ('frecuente', 7, 'Cambiar estacones quebrados y cuerdas reventadas; desechar la madera mala y el alambre de forma segura.'),
  ('frecuente', 8, 'Marcar las vacas con retiro de leche (collar o tinta) y anotar fecha de retiro y de reingreso al tanque.'),
  ('frecuente', 9, 'Recibir concentrado y fertilizante, diligenciar la planilla de ingreso y registrar las salidas al consumir.'),
  ('frecuente', 10, 'Hacer los pedidos los viernes por escrito en el grupo de WhatsApp; se entregan a más tardar el domingo.'),
  ('frecuente', 11, 'Arreglar la vía principal de la finca para evitar huecos o derrumbes.'),
  ('frecuente', 12, 'Mantener limpias la casa, la sala de ordeño, el patio de espera y los caminos.'),
  ('frecuente', 13, 'Llevar las basuras al punto de acopio los miércoles y los viernes.'),
  ('frecuente', 14, 'Quemar los cachos a las terneras de 10 días de nacidas y verificar que quede bien hecho.'),
  ('frecuente', 15, 'Cada 3 días revisar conexiones de agua y que los tanques de almacenamiento estén llenos y sin fugas.'),
  ('frecuente', 16, 'Revisar que ninguna vaca que entra a la sala esté coja; si pasa, llamar al administrador de inmediato.'),
  ('frecuente', 17, 'Cumplir las demás asignaciones del administrador o del dueño de la finca.'),
  ('frecuente', 18, 'El gas lo compra cada viviente para su consumo.'),
  ('frecuente', 19, 'Cada 15 días verificar que todas las vacas tengan chapeta; si falta, informar número y nombre.'),
  ('frecuente', 20, 'Al retirarse debe hacerse los exámenes de retiro para poder ser liquidado.');
