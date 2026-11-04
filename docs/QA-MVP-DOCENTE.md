# MVP docente · resumen de grupo con datos reales

Rama: `codex/teacher-mvp` · base `cf2704dfe37ce79cc8696b7cf5d2131a2a976a9e` · 4 de noviembre de 2026.

Alcance: Firestore Emulator y cuentas sintéticas. **Sin producción, sin despliegue, sin merge y sin tocar los 28 juegos.**

## Resultado

La profesora ficticia A abre `#/docente` → **Resumen** y ve el grupo real del periodo:

- 2 alumnos inscritos y 2 con actividad.
- 1 actividad abierta, 1 practicada, 1 resultado informado y 1 finalización reportada; 0 validadas.
- B completó un Memorama real; su intento y progreso se sincronizaron desde el cliente.
- C marcó una práctica; quedó declarada, sin convertirla en completada.
- Recarga, aislamiento entre docentes y revocación de B comprobados.
- El backend autoriza `groupProgress` con `readHistory`; un docente ajeno, alumno o externo recibe 403. Un docente puede administrar miembros sin leer historiales, y otro leer historiales sin administrar miembros.
- `validated` permanece en 0: no se eleva un autoinforme a resultado validado.

Captura sintética: [dashboard.png](qa/teacher-mvp/dashboard.png). No contiene secretos, tokens ni datos reales; no sustituye QA físico Mac↔iPhone.

## Evidencia local

| Verificación | Resultado |
|---|---|
| `node --import tsx --test tests/academic/dashboard.test.ts` | 8/8 |
| `npm run test:academic:api` | 78/78 |
| `npm run typecheck:academic` | PASS |
| `npm run build` | PASS |
| Suite docente Chromium | 71/71 |
| Suite docente WebKit | 71/71 |
| `dashboard-real-flow.spec.ts` Chromium/WebKit | PASS |

El test real usa cuentas Auth sintéticas y Firestore Emulator reales: B completa Memorama, C marca práctica y A consulta el tablero. La captura se genera con `TEACHER_CAPTURE=1`.

Los eventos de `reportedAttempts` se consultan aunque el alumno no tenga `users/{uid}/sync/current`; se descartan si no pertenecen al UID, no coinciden con el ID del documento, no usan el tipo/trust admitido, tienen fecha inválida o un resultado malformado. Así el consentimiento de intentos es independiente del consentimiento de progreso.

Para reproducir, los emuladores deben arrancar desde este worktree/rama. Las Rules de `main` no incluyen todavía `reportedAttempts`; usar las Rules de esta rama. El modo local reutiliza 9099/8085/5200/5195 y `TEACHER_REUSE_VITE=1`; el CI arranca sus propios procesos.

Comandos de la suite:

```sh
npm run test:academic:api
npm run typecheck:academic
npm run build
TEACHER_BROWSER=chromium npm run test:teacher:ui
TEACHER_BROWSER=webkit npm run test:teacher:ui
```

El flujo real requiere `MEMORAMA_DIR` con el fixture pinneado de Memorama; el workflow `teacher-ci.yml` lo descarga en `.qa-memorama`. La prueba no inventa puntuaciones: el tablero muestra conteos derivados de documentos sincronizados por B/C.

## Métricas y coste

`reported` cuenta resultados informados; `completed` cuenta únicamente finalizaciones con `result.completed === true` en un intento o `gameRun`. Un `reported` sin esa evidencia no es una finalización; los diagnósticos actualizan la última actividad y no crean finalizaciones. `validated` permanece en 0.

El coste actual es explícito: cada alumno consulta hasta 2,000 eventos de `reportedAttempts`, además de su head, hasta 40 campos, 50 `gameRuns` y 50 diagnósticos. Con 100 alumnos esto puede acercarse a 200,000 lecturas por `groupProgress`. No se resuelve ahora con agregados; queda como limitación para el siguiente incremento.

## Snapshot productivo read-only

**No ejecutado.** Requiere autorización separada del propietario y una cuenta ADC de solo lectura; no se usan credenciales reales en este incremento.

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/fuera-del-repo/adc-readonly.json
export SINGLE_OPERATOR_SNAPSHOT_APPROVAL=read-only-approved
npm run single:snapshot -- \
  --target production \
  --project optilab-cd829 \
  --execute \
  --confirm snapshot:optilab-cd829 \
  --out /ruta/fuera-del-repo/optilab-baseline
```

- La ruta `--out` debe estar **fuera de Git**; el script la rechaza dentro del repositorio y crea archivos privados con permisos restringidos.
- La ADC debe permitir únicamente GET de la release y el ruleset de Firebase Rules, más la metadata de plataforma que valida el propio script. No se requieren credenciales de aplicación, IAM ni acceso a documentos de alumnos.
- Resultado esperado si se autoriza: `snapshot.json`, `baseline.rules` y `firebase-baseline.json`; el recibo reporta `productionWrites:false` y `privateFilesWritten:true`, con `sourceSha256` verificable.
- El script es de solo lectura, pero no está ejecutado ni se declara un resultado productivo.

## Pendiente para producción

- Desplegar Rules/índices y configurar el proyecto real con autorización independiente.
- Piloto multiusuario productivo con cuentas docentes reales, verificación de correo, recuperación y roles operados por un administrador de confianza.
- Migración/privacidad/retención de datos, backups, observabilidad, límites de cuota y soporte.
- Validación física Mac↔iPhone, accesibilidad y comportamiento con grupos grandes.

## Siguiente incremento recomendado

**Piloto multiusuario productivo controlado**, porque el tablero ya demuestra el flujo completo pero solo con emuladores y cuentas sintéticas. Sin Rules desplegadas, cuentas reales y operación no se puede afirmar que el criterio funcione en producción. Después: editor drag-and-drop de periodos/grupos/alumnos; rankings al final, con anti-abuso y reglas de privacidad.
