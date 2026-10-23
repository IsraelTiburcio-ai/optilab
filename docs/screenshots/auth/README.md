# Capturas de Authentication

Se generan con `UPDATE_AUTH_SCREENSHOTS=1` al ejecutar la suite de Auth contra Firebase Auth Emulator (`demo-optilab-auth`). Son formularios con campos vacíos y un perfil educativo sintético; no muestran credenciales, tokens ni cuentas reales.

Los tamaños son 390×844, 820×1180, 1180×820 y 1440×900. Las imágenes se incluyen para revisión de la PR, no como evidencia de acceso Google/correo en producción. La página muestra explícitamente que el entorno es un emulador.

```sh
UPDATE_AUTH_SCREENSHOTS=1 npx --yes firebase-tools@15.0.0 emulators:exec --only auth --project demo-optilab-auth --config firebase.auth-emulator.json "npm run test:auth -- --browser chromium"
```
