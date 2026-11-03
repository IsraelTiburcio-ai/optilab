# Intentos locales v1 — entrega parcial de #7

Base: main a5c60d1. Se revisó #26 (0c4dac6, base previa 71916df): no se incorporan commits ni gates de esa rama. El dominio publicado ya es optilab.club. Esta entrega no activa Cloud ni cierra #7.

El ledger local requiere consentimiento por invitado/UID. Integra únicamente mensajes aceptados por los receptores existentes y práctica declarada. El UUID de run es la clave idempotente por actividad: el primer informe gana, incluso frente a un replay modificado tras recarga. Web Locks serializa escrituras entre pestañas del mismo navegador; sin soporte se falla cerrado. Límite 2000 eventos sin expulsión de claves anti-replay; exportar al llegar al límite. El usuario que cambie de cuenta debe reabrir el visor antes de registrar nuevos intentos. No se importan perfiles automáticamente. El almacenamiento local no es una frontera de seguridad frente al propietario del navegador ni una firma del resultado.

Se conservan solo campos realmente recibidos. `observedAt` es la hora de observación del host, no un tiempo de inicio del juego ni un timestamp confiable. `reported` no equivale a resultado validado ni necesariamente a partida terminada (puede existir reason=time-limit). Apertura y práctica declarada tienen confianza declaration; los informes client-report. No se admite server-validated en el contrato cliente. Las métricas son conteos por actividad, sin promedios de unidades incompatibles ni rankings. Se muestran las últimas 50 entradas y se exporta todo el ledger.

## Integración futura

Separar el adaptador de almacenamiento y el validador confiable: en Firestore, UID se deriva de Auth y del path, nunca de un campo controlado por el navegador. Documentos por actividad/run con create-only, límite de esquema/tamaño y permisos del propietario; un namespace distinto de evidencia/resúmenes solo escribible por un servicio autorizado. El panel docente requiere membresías y proyecciones mínimas por curso/grupo/revisión (#3/#5/#6). Los timestamps confiables y la elevación de confianza pertenecen al servicio. Las Rules no garantizan rate limiting ni antitrampas. Retención, cuotas, export/borrado y despliegue requieren revisión separada. No reutilizar los gameRuns de #26 para los otros 27 juegos: esa rama limita su esquema a Memorama.

## Evidencia

PASS: build TypeScript/Vite; 7 tests de contrato (campos ausentes, dedupe/replay, confianza, métricas negativas, apertura distinta de resultado, recarga/corrupción). PASS: 2/2 recorridos por motor en Chromium y WebKit: consentimiento/práctica/recarga y receptor Memorama con fixture, informe repetido y persistencia. Pendientes: matriz Auth A/B con emulador, límite de almacenamiento y prueba multi-tab de integración; no declarar producción certificada por estas pruebas locales.
