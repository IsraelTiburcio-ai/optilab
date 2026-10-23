# Checklist manual · Firebase Authentication real · PR #11

La [PR #11](https://github.com/IsraelTiburcio-ai/optilab/pull/11) permanece abierta como borrador. No fusionar ni desplegar hasta registrar los resultados. No se inició el issue #3.

## Comprobado automáticamente

- Las seis Repository Variables existen. Los cinco valores de proyecto/app coinciden con los proporcionados.
- La API key real es aceptada por la consulta pública de Authentication: HTTP 200. El proyecto devuelto es `401863964479`, consistente con sender y app ID.
- Dominios autorizados devueltos por Firebase: `localhost`, `optilab-cd829.firebaseapp.com`, `optilab-cd829.web.app`, `israeltiburcio-ai.github.io`. `127.0.0.1` no está incluido; usar **localhost**.
- Con la configuración real y sin emulador, una sesión de navegador limpia inicializó Cuenta y recargó conservando literalmente `optilab-v1`. Se observaron **0 solicitudes Firestore** y **0 operaciones de creación/acceso/envío de correo**. No se crearon cuentas ni se enviaron correos reales.
- App/Auth son los únicos servicios Firebase importados por el cliente. No hay código Firestore ni escritura propia del estado de autenticación en `optilab-v1`.

Lo anterior no demuestra todavía que Google o los flujos de correo reales funcionen de extremo a extremo. Los proveedores habilitados y la entrega de correos se confirman con los pasos siguientes.

## Tus pasos exactos

1. **Abrir la rama local de revisión.**

   ```sh
   git switch feat/firebase-auth
   git pull --ff-only
   npm ci
   test -f .env.local || cp .env.example .env.local
   ```

   Completa `VITE_FIREBASE_API_KEY` en `.env.local` con el valor de la misma variable de GitHub (o `apiKey` de Firebase Console → Configuración → OptiLab Web). Conserva los otros cinco valores del ejemplo. No establezcas `VITE_FIREBASE_AUTH_EMULATOR_URL`. Las variables de Actions **no se cargan automáticamente en tu terminal**. No compartas contraseñas o tokens.

   ```sh
   npm run dev -- --host localhost --port 5173 --strictPort
   ```

   Abre **http://localhost:5173/optilab/#/cuenta**. Si el puerto está ocupado, detén el servidor anterior; no cambies de hostname/puerto durante la comparación. No debe verse el aviso de emulador ni de configuración incompleta.

2. **Preparar la comparación del progreso.** Espera a que Cuenta esté lista. En la consola de DevTools de esa pestaña ejecuta:

   ```js
   sessionStorage.setItem('optilab-qa-before', localStorage.getItem('optilab-v1') || '');
   ```

   Durante estas pruebas no marques juegos ni cambies personajes/apodo. Después de cada acceso, recarga y logout, ejecuta:

   ```js
   localStorage.getItem('optilab-v1') === sessionStorage.getItem('optilab-qa-before')
   ```

   Debe devolver **true**. El respaldo está solo en sessionStorage de esa pestaña; no modifica la clave original. El progreso de GitHub Pages vive en otro origen y no se importa automáticamente a localhost; que no aparezca allí no significa que se haya borrado.

3. **Google — requiere tu cuenta real.** Pulsa **Continuar con Google**, elige tu cuenta y completa el popup. Esperado: **Sesión iniciada** y tu correo. Si se bloquea, permite ventanas emergentes para localhost y vuelve a pulsar. No compartas la sesión ni sus tokens.

4. **Persistencia y logout — manual.** Recarga y luego cierra/reabre la pestaña en la misma URL: debe conservar la sesión. Pulsa **Cerrar sesión**: debe volver al acceso/invitado. Comprueba **true** en la comparación de progreso. Si aparece el aviso de sesión temporal, no marcar persistencia como aprobada: revisar permisos de almacenamiento.

5. **Registro por correo — requiere otra dirección tuya accesible.** Usa un correo distinto del utilizado con Google para no confundir un conflicto legítimo de proveedores con un fallo. Pulsa **Crear cuenta**, introduce correo y contraseña, confirma y envía. Esperado: sesión activa, correo recibido y verificación pendiente.

6. **Verificación — requiere abrir el correo.** Abre el enlace de verificación y vuelve a la **pestaña original** de OptiLab. Pulsa **Ya verifiqué mi correo**: debe mostrar **Correo verificado**. Cierra sesión y entra mediante correo/contraseña; recarga y vuelve a comprobar progreso **true**.

7. **Recuperación — requiere recibir otro correo.** Cierra sesión → **Recuperar** → introduce el correo del paso 5 → **Enviar enlace de recuperación**. Abre el enlace, cambia la contraseña y vuelve a entrar con la nueva. Comprueba de nuevo progreso **true**. La respuesta genérica del formulario por sí sola no acredita entrega del correo.

8. **Cero Firestore durante los flujos reales.** En DevTools → Network activa **Preserve log**, filtra `firestore.googleapis.com` y repite acceso/recarga/logout/recuperación. Debe haber **0 solicitudes**. Sí son esperables llamadas a `identitytoolkit.googleapis.com`, `securetoken.googleapis.com` y helpers de Authentication. Crear un usuario en Authentication no crea un documento Firestore en esta implementación.

9. **Invitado y reporte.** Cierra sesión → **Continuar como invitado**. Verifica mapa, personajes e insignias, y la comparación **true**. Repite Google/correo en Safari si lo usas (cada navegador tiene su propio estado local). Informa PASS/FAIL de cada paso en la PR; si falla, comparte el texto del error, navegador y paso, nunca contraseña, tokens o códigos de correo.

## Aún requieren intervención humana

Google con tu cuenta, entrega y apertura de correos, contraseña nueva, cierre/reapertura de tu navegador y comportamiento en Safari/dispositivos físicos. Ninguno se marca como aprobado a partir del emulador o de la consulta pública. La validación sobre el dominio publicado seguirá pendiente hasta disponer de un entorno autorizado; no se desplegó esta PR para probarlo.
