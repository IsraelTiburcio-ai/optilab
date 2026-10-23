export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-email': return 'Revisa el formato de tu correo electrónico.';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements': return 'La contraseña no cumple la política del proyecto. Prueba una más larga y combina distintos caracteres.';
    case 'auth/email-already-in-use': return 'No pudimos crear esta cuenta. Si ya tienes acceso, prueba entrar o recuperar tu contraseña.';
    case 'auth/invalid-credential': case 'auth/invalid-login-credentials': case 'auth/user-not-found': case 'auth/wrong-password': return 'No pudimos iniciar sesión. Revisa tu correo y contraseña.';
    case 'auth/popup-blocked': return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para OptiLab y vuelve a pulsar el botón, o usa correo si configuraste ese acceso.';
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request': return 'Se cerró la ventana de Google antes de terminar. Puedes intentarlo de nuevo o continuar como invitado.';
    case 'auth/unauthorized-domain': return 'Este dominio todavía no está autorizado para acceder con Google. El propietario debe revisarlo en Firebase Authentication.';
    case 'auth/account-exists-with-different-credential': return 'Esta cuenta utiliza otro método de acceso. Entra con el método que utilizaste al registrarte.';
    case 'auth/operation-not-allowed': return 'Este método de acceso no está habilitado en Firebase. Puedes continuar como invitado.';
    case 'auth/network-request-failed': return 'No pudimos conectar con el servicio de cuentas. Revisa tu conexión e inténtalo de nuevo.';
    case 'auth/too-many-requests': return 'Hay demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.';
    case 'auth/user-disabled': return 'Esta cuenta no está disponible. Contacta con el responsable del proyecto.';
    case 'auth/invalid-api-key': case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.': case 'auth/app-not-authorized': return 'La configuración pública de Firebase necesita revisión. Tu aventura local sigue disponible.';
    case 'auth/verification-send-failed': return 'Tu cuenta ya está creada, pero no pudimos enviar la verificación. Puedes solicitarla de nuevo desde esta pantalla.';
    case 'auth/no-current-user': return 'Tu sesión ya no está activa. Vuelve a entrar para continuar.';
    case 'auth/session-changed': return 'La sesión cambió en otra pestaña durante el acceso. Vuelve a entrar; no se abrió el progreso de otra cuenta.';
    default: return 'No pudimos completar esta acción. Inténtalo de nuevo; tu progreso local permanece en este navegador.';
  }
}
