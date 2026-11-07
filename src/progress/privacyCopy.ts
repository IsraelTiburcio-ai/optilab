export function adventureStorageNotice(mode:'disabled'|'emulator'|'production'){
  if(mode==='production')return 'Perfil aislado por cuenta. La sincronización con Firebase requiere tu consentimiento; consulta el estado y los respaldos arriba.';
  if(mode==='emulator')return 'Perfil aislado por cuenta. Sincronización con emuladores locales; consulta el estado y los respaldos arriba.';
  return 'Esta aventura se guarda únicamente en este navegador. No se sincroniza entre dispositivos y puede perderse al borrar los datos del sitio.';
}
export function attemptStorageNotice(cloudAvailable:boolean){
  return cloudAvailable
    ?'Puedes sincronizar estos informes entre dispositivos con consentimiento independiente; consulta el estado del canal de intentos. El ranking de participación tiene consentimiento adicional y no utiliza puntuaciones.'
    :'No se sincronizan ni se usan para rankings.';
}
