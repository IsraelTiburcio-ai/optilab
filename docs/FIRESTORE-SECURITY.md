# Firestore · permisos, emulador y operación controlada

Issue #3, rama `feat/firestore-security`. [ADR](architecture/ADR-001-firestore-security.md), [presupuesto Spark](FIRESTORE-BUDGET.md), contratos `src/types/cloud.ts`.

## Estado de entrega

Se entregan reglas/índices versionados y tests ejecutables, no integración Firestore de la aplicación. No getFirestore, listeners, migración ni cambios a Auth/store/catálogo/juegos. No se publicaron reglas; producción conserva el estado deny-all informado por el propietario. No se verificó ese ruleset mediante acceso de administración a Firebase.

Validación local final: **95/95 tests Firestore/guardas PASS**, incluido control de mutación; **67 regresiones Chromium PASS**, cuatro casos públicos opt-in omitidos; los 28 destinos de juegos respondieron HTTP 200 (no acredita completar sus mecánicas). Build/TypeScript PASS y `npm audit --omit=dev`: 0 vulnerabilidades reportadas. El diff de `src` contra `5df2258`, excluyendo el nuevo archivo de tipos, es vacío. Resultados de CI del commit final se enlazan en la PR.

## Matriz efectiva de reglas de #3

Todos los actores son Firebase Auth no anónimo; Firebase Anonymous Auth también queda excluido. “Docente” requiere **ambos** documentos staff activos y contexto válido. Campos de rol/claims autodeclarados no conceden nada.

| Ruta / operación | Sin sesión o Auth anónima | Alumno propietario | Otro alumno | Docente del grupo | Docente ajeno |
|---|---|---|---|---|---|
| users/{uid} get/create mínimo | Denegar | Permitir | Denegar | Solo propio UID | Solo propio UID |
| progress/current get/create/update válido | Denegar | Permitir, CAS | Denegar | Solo propio UID | Solo propio UID |
| runs/diagnostics/hitos get/create válido | Denegar | Permitir, autorreportado | Denegar | Solo propio UID | Solo propio UID |
| runs/diagnostics list | Denegar | ≤50 | Denegar | Solo historial personal propio | Solo historial personal propio |
| hitos / enrollments list | Denegar | ≤2 / ≤20 | Denegar | Solo propios | Solo propios |
| curso / grupo get | Denegar | Grant válido del ámbito | Sin grant: denegar | Dentro de su asignación | Denegar |
| membresía de grupo get | Denegar | Propia y activa | Denegar | Documento válido del grupo asignado | Denegar |
| resumen de alumno get | Denegar | Propio y miembro activo | Denegar | Solo grupo asignado, validado | Denegar |
| fila leaderboard get | Denegar | Grupo propio activo, fila sanitizada | Otro grupo: denegar | Solo grupo asignado | Denegar |
| escribir grants, staff, resúmenes o ranking | Denegar | Denegar | Denegar | Denegar | Denegar |
| borrar documentos desde cliente | Denegar | Denegar | Denegar | Denegar | Denegar |
| listas académicas / collectionGroup / rutas futuras | Denegar | Denegar | Denegar | Denegar | Denegar |

Un alumno de grupo A puede leer una fila pseudónima del ranking A, no información privada del compañero. No hay consultas completas de ranking ni productor competitivo en este issue. `enrollments` es descubrimiento privado mantenido por operador y no autoridad. Reglas deniegan documentos adicionales/campos inesperados en escrituras personales y en grants/proyecciones usados para autorizar. Ante relaciones inexistentes o inconsistentes se falla cerrado.

## Pruebas locales reproducibles

Requisitos: Node 22, Java 21 en PATH, npm. No requiere login Firebase ni cuenta de servicio.

```sh
npm ci
java -version
npm run test:firestore
npm run build
```

En macOS con Homebrew y Java keg-only, ejecutar el comando de test con:

```sh
JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home" PATH="$(brew --prefix openjdk@21)/bin:$PATH" npm run test:firestore
```

`scripts/test-firestore.mjs` fija `demo-optilab-firestore`, CLI 15.0.0, solo Firestore, config aislada y 127.0.0.1:8085. Rechaza argumentos/host heredado. El test rechaza cualquier host distinto **antes** de initializeTestEnvironment, usa host/port/project explícitos y no lee .env.local. No modificar el comando para apuntarlo a un proyecto real. Config Auth existente 9099 queda separada y compatible; no se cambia su infraestructura. Java se necesita solo para este emulador.

Fixtures sintéticos: alumno A/B, docente A/B, anónimo/no autenticado y operador exclusivamente `withSecurityRulesDisabled`. Se limpian datos locales antes de cada prueba. Test de mutación instala temporalmente reglas deliberadamente inseguras **solo en el demo local** y verifica que la misma aserción de aislamiento detecta el fallo; finalmente restaura las reglas seguras. No reutilizar esas reglas inseguras fuera del fixture.

Cobertura: CRUD personal permitido/denegado, cada una de las 28 fechas de práctica, límites/IDs/tipos/payloads, CAS/timestamps inmutables, historiales append-only, grants falsos y batch, consultas amplias, ámbitos cruzados, grants ausentes/malformados/revocados, homónimos entre periodos, cambios de membresía sin tocar progreso, docente fuera de ámbito, proyecciones con campos privados y rutas administrativas/editor cerradas. Ver resultados exactos en la PR; emulador no verifica IAM, abuso real, región, cuotas ni índices productivos.

## Revisión de autorización

- Los únicos allow de escritura son ownership + esquema de datos personales; ninguna condición usa roles cliente o adopta uid del payload como autoridad.
- Autorización por ámbito: tres documentos de contexto (curso/periodo/grupo) y dos grants por rol. Normalmente cinco dependencias; al probar ambas ramas alumno/docente puede llegar hasta siete documentos únicos. El contexto se valida una sola vez y las pruebas positivas se ejecutan dentro del límite de diez accesos y 1.000 expresiones por operación. No extrapolar a batches administrativos futuros (20 accesos globales y diez por operación).
- Datos personales acotados por IDs/longitudes; no arrays infinitos en progress/current. La validación explícita de fechas se optimizó para respetar las 1.000 expresiones de Rules; el test con las 28 entradas y el hito completo verifica ese límite práctico.
- Los límites de página no limitan frecuencia ni total de intentos. Un cliente autenticado malicioso puede agotar Spark escribiendo su propio historial o repitiendo lecturas. Rules no es rate limiter; monitorización y una eventual defensa de abuso/App Check requieren diseño/aprobación antes de grupos reales. No se activaron servicios.
- Staff no obtiene progreso personal global del alumno: solo proyecciones académicas autorizadas. La futura consulta individual de #9 debe usar historial contextual del grupo, no ampliar acceso a users/* indiscriminadamente.

## Publicación futura de reglas — NO ejecutada

1. Revisar y aprobar PR/SHA, esquema, tests, cuotas y mecanismo de grants. Confirmar Spark, proyecto `optilab-cd829`, base `(default)` y región indicada. No crear otra base ni cambiar región/plan.
2. Guardar copia privada del ruleset/índices vigentes y su identificador. Actualmente se informa deny-all; no asumirlo sin comprobar Console en la ventana autorizada.
3. Decidir si aprobar solo rules o también índices. El compuesto futuro de activities no es necesario para #4. No usar `firebase deploy` genérico ni un default project implícito.
4. Solo con permiso explícito, un operador publica el SHA revisado. Comando orientativo, **no ejecutar ahora**:

   ```sh
   npx --yes firebase-tools@15.0.0 deploy --only firestore:rules --project optilab-cd829 --config firebase.firestore-emulator.json
   # Índices: autorización separada y revisar eliminaciones de índices existentes.
   # npx --yes firebase-tools@15.0.0 deploy --only firestore:indexes --project optilab-cd829 --config firebase.firestore-emulator.json
   ```

   El archivo contiene el bloque firestore de despliegue y el emulador; el script de tests nunca ejecuta deploy. No hay `.firebaserc`, action de deploy Firestore, credenciales ni backend administrativo en esta entrega.
5. Comprobar ruleset activo y estado READY de índices autorizados antes de una integración. El smoke productivo con cuentas/datos propios requiere permiso independiente: los tests locales no crean datos de producción.
6. Rollback autorizado: restaurar ruleset previo mediante operador, registrar SHA/ruleset y repetir revisión. Restaurar deny-all bloquea sincronización remota, no borra datos ni revoca Auth. Desplegar reglas es independiente de Pages; merge a main sí dispara el workflow Pages existente, por eso tampoco se fusiona esta PR sin permiso.

## Siguiente fase #4

Implementar cliente lazy, consentimiento/importación explícita, UID isolation, listeners mínimos con cleanup, reconciliación/CAS, offline/conflictos, idempotencia, backup y flujo de reset/borrado acordado. Aprobar las reglas antes de habilitar ese cliente. No bastará con añadir getFirestore al arranque actual.
