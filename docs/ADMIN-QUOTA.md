# Cuota local de herramientas administrativas (Node 22)

`pilot-admin` y `pilot-activation` validan el destino y la cuota antes de cargar ADC/SDK o
hacer solicitudes. Para producción, el único proyecto admitido es `optilab-cd829`.
Una cuota explícita diferente se rechaza, incluso en dry-run; nunca se sustituye en silencio.

Después de superar los controles existentes de ejecución, aprobación y confirmación, la
herramienta establece `GOOGLE_CLOUD_QUOTA_PROJECT=optilab-cd829` solo durante la operación
administrativa y su limpieza. También cubre el preflight de metadatos de `pilot-activation`.
El entorno previo se restaura en `finally`; Firestore termina y la instancia Admin se elimina,
incluso tras errores de operación o inicialización parcial. No se edita ADC ni gcloud.

## Desde la Mac: ejemplos exclusivamente dry-run

En un checkout de esta versión, con Node 22 y dependencias ya instaladas:

```bash
npm run pilot:admin -- pause --target production --project optilab-cd829
npm run pilot:activation -- plan
```

Estos comandos no cargan credenciales, no hacen solicitudes y no ejecutan operaciones.
No necesitas exportar ninguna variable. Si deseas declararla expresamente, hazlo por comando:

```bash
GOOGLE_CLOUD_QUOTA_PROJECT=optilab-cd829 npm run pilot:activation -- plan
```

Las futuras ejecuciones con `--execute` continúan requiriendo las mismas aprobaciones,
confirmaciones, manifiesto/recibos y controles de admisión. Este cambio no autoriza ninguna.
No ejecutes `gcloud auth application-default set-quota-project`, no cambies configuración global
ni copies ADC o claves al repositorio. La cuota no concede permisos ni habilita billing/APIs/Sync.

## Emuladores

Se conservan `demo-optilab-sync`, Auth `127.0.0.1:9199` y Firestore `127.0.0.1:8185`.
No se añade una cuota productiva al modo emulador. Si hay una variable de cuota heredada,
debe ser coherente con el destino demo; otro proyecto se rechaza. Usa variables por comando,
no un `export` global que contamine las pruebas. Los endpoints incompatibles se rechazan
antes de inicializar el SDK y ahora también antes del preflight de producción.

## Verificación automatizada sin producción

```bash
node --test --test-reporter=spec tests/pilot/admin-process.test.mjs tests/pilot/platform.test.mjs
npm run build
```

Los tests usan entornos y SDK simulados, y bloquean red y cargas SDK/ADC en los subprocesos
que prueban dry-run y denegaciones. No contienen cuentas, claves ni datos privados. Las pruebas
mock comprueban la configuración previa al SDK; no sustituyen una auditoría real de permisos.
La validación real previa de `listUsers(1)` con cuota explícita no se repite en esta PR.
