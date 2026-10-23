# Progreso Cloud #4 · implementación exclusiva en emuladores

Base `main` `adc8b17`. [ADR-002 y matriz de conflictos](architecture/ADR-002-progress-sync.md). No merge, publicación pública, Firebase Console, documentos reales, reglas/índices productivos, Blaze o Functions autorizados/ejecutados.

## Ejecutar y revisar

Node 22, Java 21 en PATH y dependencias instaladas:

```sh
npm ci
npm run test:sync
SYNC_BROWSER=webkit npm run test:sync
npm run test:sync:production
npm run test:firestore
npm run build
```

La prueba de partida integrada usa un clon de solo lectura de `memorama-simplex` en el commit `7a58545df7d3a657e85c2a87091f3277cdae97c0`. CI lo obtiene fijado; para ejecutarla localmente definir `MEMORAMA_DIR` con ese clon. Sin esa variable, ese único caso se omite y el resto de sync se ejecuta normalmente. No se modifica ni publica el juego.

El test de producción usa **preview local en 5196**, con todas las variables sobrescritas por fixtures demo. Fuerza flags de emulador en build para comprobar rechazo seguro: Auth informa configuración incompatible, invitado sigue operativo, no se cargan chunks de sync ni se intenta ninguna petición Firebase. No prueba ni modifica el login del sitio publicado.

El wrapper fija demo-optilab-sync y ambos emuladores, rechaza hosts heredados/argumentos de proyecto. Cada test de integración/UI verifica endpoints exactos antes de inicializar; tests de guardas comprueban el rechazo. No requiere login Firebase ni credenciales administrativas.

En macOS con Java keg-only, anteponer a cada comando de emulador:

```sh
JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home" PATH="$(brew --prefix openjdk@21)/bin:$PATH" npm run test:sync
```

Revisión manual, dos terminales:

```sh
# Terminal 1
npm run emulators:sync
# Terminal 2
npm run dev:sync
```

Abrir `http://127.0.0.1:5195/optilab/`. Usar cuentas sintéticas `@example.test` creadas en ese Auth Emulator; otro navegador/contexto puede entrar con la misma cuenta para comprobar convergencia. El SDK obtiene los tokens del emulador, no se manipulan manualmente.

`dev:sync` sobrescribe las seis variables Firebase con fixtures demo además de ambos endpoints. No editar/copiar el `.env.local` real. El servidor de QA está en 5195; suites existentes usan 5187/5188. Emuladores 9099/8085 no deben ejecutarse dos veces a la vez; los jobs CI están en VMs independientes. Los datos del emulador son efímeros sin exportación manual.

## Flujo de estudiante

1. Invitado continúa con `optilab-v1` sin Firebase; producción sigue en ese modo de progreso compartido del navegador aun al autenticar, como anuncia su UI. La nueva separación por UID solo se activa en el entorno emulado.
2. Login en emulador abre perfil de cuenta separado, sin copiar invitado. Panel: progreso local, pendiente, sincronizando, sincronizado, sin conexión, conflicto o error recuperable. Se puede navegar mientras espera, sin afirmar ACK antes de tenerlo.
3. Importar guarda copia exacta y valida; conservar remoto no elimina legado; cancelar no escribe Cloud. Revisar muestra remoto y origen. Para otra cuenta se pide decisión distinta; no se comparte su cache/journal/backups con A.

El consentimiento de cuenta se comparte entre pestañas del mismo UID/navegador. Cancelar la importación pausa envíos y conserva cambios propios pendientes; usar la cuenta los habilita, sin copiar el invitado. Al salir se etiqueta explícitamente la copia invitada: puede parecerse al legado que se importó, pero no se vuelcan en ella ediciones privadas posteriores de la cuenta.
4. Editar prácticas, visitar, elegir equipo, generar ruta y completar actividades conserva el comportamiento académico. Solo las operaciones del usuario producen envíos. Apodo se guarda al salir del campo, no por tecla.
5. Conflicto: comparar ambos valores, elegir remoto guardando copia o aplicar cambios revisados. Cambios de generación e historias con un mismo ID/datos diferentes no permiten sobrescritura rápida.

## Respaldo y restauración

- **Crear y exportar respaldo** descarga JSON privado del perfil visible (incluidas operaciones pendientes), con UID/checksum; intenta además guardarlo en el navegador. Puede exportar aunque falte espacio para guardar otra copia.
- **Exportar original del navegador** conserva el legado previo a normalizaciones. El área invitado no recibe datos de cuentas. No compartir archivos con datos educativos.
- **Respaldos de esta cuenta** permite exportar o revisar una restauración; también se puede elegir un archivo. Máximo de archivo UI: 2 MB. Revisa contenido antes de confirmar; un archivo de otro UID o alterado se rechaza.
- Restore crea un epoch nuevo y conserva el anterior. No sobrescribe historia inmutable ni revierte un reset mediante una cola vieja. Reset de aventura también conserva historia; borrar definitivamente no está habilitado.
- El raw del perfil visible contiene sus últimos 30 diagnósticos/50 runs, como el store original. El archivo incluye además el journal pendiente completo y sus hashes: no se pierden 120 intentos offline por ver solamente 30. Restore recupera la historia activa adicional por bloques idempotentes y mantiene el estado pendiente hasta confirmarlos. Historia de un checkpoint anterior a reset no se reactiva al restaurar un checkpoint posterior.
- Estos archivos no son una exportación completa de todas las generaciones Cloud ni un backup administrado de Firestore. Eventos anteriores ya enviados siguen en su generación, aunque no se descarguen para cada vista. Un remoto v1 o un cache incompatible no se convierten silenciosamente; una copia con UID ajeno no se muestra, y el cache se conserva en cuarentena local al elegir reemplazarlo por remoto.
- Se conserva raw antes de hash/parse/commit. Ante datos incompatibles, copia disponible y mensaje; no se corrigen resultados ni se truncan historiales arbitrarios para hacer que una importación “pase”. Una copia antigua sin ID de diagnóstico usa hash+ordinal; ver ambigüedad documentada en ADR.
- Si se bloquea totalmente almacenamiento, importación/reset no avanzan sin respaldo persistente; copia temporal y exportación disponibles. Si se agota cuota durante edición, conservar pestaña y exportar; no se promete durabilidad imposible.

## Evidencia automatizada y límites

Validación local: **30/30 core/guardas/integración PASS**, cinco escenarios UI en Chromium y cinco en WebKit (incluida partida real del fixture Memorama y su recepción en otro cliente), cuatro viewports y Axe del panel. **95/95 reglas previas PASS**, Auth **9/9 por navegador** y configuración/invitado **6/6 WebKit**. TypeScript/build y preview de producción seguro PASS; `npm audit --omit=dev`: 0 vulnerabilidades reportadas.

Regresión general: 66 PASS, cuatro públicos opt-in omitidos y un timeout de carga de ilustraciones Cloudinary; se repitió únicamente ese caso sin modificarlo y pasó. Son 67 escenarios locales distintos cubiertos, no se presenta la primera ejecución como completamente verde. Los 28 destinos devolvieron HTTP 200, sin afirmar completar sus 28 mecánicas. El resultado CI del commit final se enlaza en la PR.

Se cubren modelos/guardas, Auth+Firestore Emulator con usuarios SDK reales sintéticos, dos clientes, máxima importación (122 writes atómicas), consentimiento/cancelación/replay, pérdida de ACK, offline/recarga, tombstones, conflicto, reset/restauración, guardas de ciclo de sesión/almacenamiento y reglas negativas. La UI prueba Chromium/WebKit, cuatro viewports y Axe del panel. Las suites previas de reglas/Auth/regresión permanecen independientes. Resultados finales exactos y links CI se registran en la PR.

No equivale a QA en Mac/iPhone físicos, producción, uso facturado, índices READY, larga duración ni bajo todas las restricciones de navegadores. No se envían cuentas/correos reales. No se cambian los 28 juegos, catálogo, cinco familias ni `evolutionRules.ts`.

## Estimación Spark v2 — no medición

70 alumnos, dos sesiones por día, 80 días lectivos y 100–500 intentos/alumno/semestre (7.000–35.000 intentos). Una generación normal; reservar hasta ~83 operaciones adicionales por alumno por prácticas/desmarcados, visitas, preferencias y celebraciones. Nuevos resets/restores/importaciones aumentan consumo, no usar estas cifras como límite garantizado.

| Recurso | Hipótesis / estimación |
|---|---|
| Lectura de inicio maduro | Head + ≤40 campos + últimos 30 diagnósticos/50 runs: ≤121 documentos/sesión; nueva cuenta también consulta presencia v1 y cobra mínimos de queries vacías |
| Lecturas iniciales/día | 70 ×2 ×121 ≈16.940 |
| Operación típica | Head/recibo/campo o intento leídos; reservar hasta 3 dependencias Rules adicionales y notificaciones a dos clientes: ~10 lecturas por op, variable con contención |
| Total diario orientativo | ~18.500–22.500 lecturas/día normal; reservar hasta ~30.000 para margen/reconexiones, frente a 50.000 gratuitas |
| Escrituras | Edit típico: head+campo+recibo =3; run/diagnóstico: head+evento+recibo =3; hito puede agregar campo; reset=2; ~500–1.600/día con las hipótesis, reservar ~2.000 |
| Importación máxima | 40 campos +80 históricos +head+recibo =122 writes; 70 alumnos el mismo día ≈8.540 writes, más tráfico/reintentos. No repetir automáticamente |
| Documentos/historia | Reservar 2 KiB/intento +0,5 KiB de índice, 1 KiB/recibo y ~30 KiB de campos/usuario/generación: orden ~32–130 MiB/semestre normal |
| Transferencia | Inicio ~90–100 KiB por sesión madura más cambios/protocolo: reservar ~0,5–1,5 GiB/mes normal, frente a 10 GiB gratis |

Las cuatro suscripciones están acotadas y se desmontan por epoch/UID; no se descarga toda la historia por render. No se indexan sync/fields/receipts; las queries de diagnóstico/run reutilizan date DESC de ADR-001. Las escrituras de índices no se facturan como otro write documental, pero consumen almacenamiento; nombres de documentos/metadatos también ocupan espacio. El emulador no exige índices compuestos ni mide facturación real.

Una reconexión masiva después de una interrupción larga puede exceder el presupuesto diario aunque la media semestral sea baja: 500 intentos pendientes ×70 alumnos ×3 writes supera 20.000/día. Quota/denials dejan el journal intacto y requieren reintento; antes de lanzamiento hace falta una política operativa de recuperación por tandas. Los respaldos/markers locales también consumen cuota del navegador; no se borran automáticamente por ocultar un conflicto.

Guardar un recibo por operación mejora idempotencia a costa de almacenamiento. Reintentos CAS/errores/denials también pueden consumir lecturas; cache de Rules solo se supone dentro de una solicitud, no entre sesiones. Un usuario malicioso o resets ilimitados pueden agotar Spark: Rules no limita frecuencia. Retención de epochs/recibos y protección de abuso necesitan decisión antes de producción. No activar TTL/backups gestionados o Functions por asumir que son gratuitos. No hay rankings ni fan-out académico en #4.

## Publicación futura y rollback — NO ejecutados

1. Revisar/aceptar ADR, conflictos, consentimiento, reset, privacidad local y presupuesto; QA físico con dispositivos del propietario.
2. Aprobar por separado el ruleset exacto v2 y, si hicieran falta, índices. El merge de código no los publica. Conservar ruleset previo; no ejecutar deploy genérico ni crear datos reales para “probar”.
3. La puerta actual exige DEV+demo+loopback: **ni siquiera poniendo flags en build se activa producción**. Activación real requiere otra PR explícita con factory/proyecto/origen aprobados, rollout acotado y plan de monitoreo. Este trabajo no la implementa.
4. Probar primero migración/restore de cuentas propias autorizadas y dos dispositivos reales; comprobar UID, journal, conflictos y cuotas antes de ampliar a alumnos.
5. Rollback autorizado de integración: desactivar conexiones y mantener lector/cache por UID y exportación; no volcar perfil privado a `optilab-v1` ni borrar journal/respaldos/epochs. La reversión estática no revoca tokens ni borra Firestore. Restaurar deny-all exige permiso propio y bloquearía operaciones remotas pendientes, que deberán conservarse localmente.

Pendientes de lanzamiento: gate real independiente, reglas/índices autorizados, estrategia para un hipotético remoto v1, política de retención/borrado, caché/origen compartido, límites de abuso/cuota, pruebas físicas offline/cierre de navegador y recuperación bajo almacenamiento restringido. No se activa Blaze ni backend privilegiado en esta fase.
