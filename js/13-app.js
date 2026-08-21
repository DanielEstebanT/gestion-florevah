/* ============================================================
   ORQUESTADOR PRINCIPAL
   render(), navegacion (nav inferior + submenus), y el arranque
   de la app. Este archivo debe cargarse SIEMPRE de ultimo, porque
   dispara iniciarApp() que a su vez llama render() usando todo
   lo que los demas modulos ya definieron.
   ============================================================ */

let tab = 'inicio';
let navMenuOpen = null;
let rowMenuOpen = null;
let formDirty = false;
let loaded = false;


function render(){
  const app = document.getElementById('app');
  if(!loaded){ app.innerHTML = `<div class="empty">Cargando tu información…</div>`; return; }
  if(!usuarioActual){ app.innerHTML = renderLogin(); return; }
  formDirty = false; // cada render() real vuelve a dejar la pantalla "limpia"
  app.innerHTML = `
    <div class="topbar">
      <div class="brand">
        ${brandMark()}
        <div class="brand-text"><div class="name">florevah</div><div class="tag">Costeo e inventario</div></div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="cerrarSesion()">Salir</button>
    </div>
    <div id="tab-content"></div>
    ${renderBottomPopup()}
    <nav class="bottom-nav">
      ${bottomNavIcon('inicio','home','Inicio')}
      ${bottomNavGroupIcon('inventario', GROUP_META.inventario)}
      ${bottomNavIcon('pedidos','bag','Pedidos')}
      ${bottomNavGroupIcon('reportes', GROUP_META.reportes)}
    </nav>
  `;
  const c = document.getElementById('tab-content');
  if(tab==='inicio') c.innerHTML = renderInicio();
  if(tab==='insumos') c.innerHTML = renderInsumos();
  if(tab==='productos') c.innerHTML = renderProductos();
  if(tab==='pedidos') c.innerHTML = renderPedidos();
  if(tab==='analisis') c.innerHTML = renderAnalisis();
  if(tab==='balance') c.innerHTML = renderBalance();
  if(tab==='historial') c.innerHTML = renderHistorial();
  if(tab==='actividad') c.innerHTML = renderActividad();
  if(tab==='resumen') c.innerHTML = renderResumen();
  attachHandlers();
}
function renderLogin(){
  return `
    <div class="login-wrap">
      <div class="login-card">
        ${brandMark()}
        <h1 class="display" style="font-size:22px;margin:14px 0 2px">florevah</h1>
        <div class="sub" style="margin-bottom:20px">Entra con tu cuenta para ver el inventario</div>
        <div class="field"><label>Correo</label><input id="login-email" type="email" autocomplete="username" placeholder="tú@correo.com"></div>
        <div class="field"><label>Contraseña</label><input id="login-pass" type="password" autocomplete="current-password" placeholder="••••••••"></div>
        <label class="login-remember">
          <input type="checkbox" id="login-recordar" checked style="width:auto">
          <span>Recuérdame en este dispositivo</span>
        </label>
        <button class="btn btn-primary" style="width:100%;margin-top:14px" onclick="intentarLogin()">Entrar</button>
        <div id="login-error" class="login-error"></div>
      </div>
    </div>
  `;
}
function intentarLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const recordar = document.getElementById('login-recordar').checked;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if(!email || !pass){ errEl.textContent = 'Completa correo y contraseña.'; return; }
  iniciarSesion(email, pass, recordar).catch(err=>{
    console.error('Error de login:', err.code, err.message);
    const mensajes = {
      'auth/user-not-found': 'No existe una cuenta con ese correo. Créala en Firebase console → Authentication → Users → Add user.',
      'auth/wrong-password': 'La contraseña no coincide con ese correo.',
      'auth/invalid-email': 'Ese correo no tiene un formato válido.',
      'auth/invalid-credential': 'Correo o contraseña incorrectos, o la cuenta no existe todavía.',
      'auth/operation-not-allowed': 'El método "Correo/contraseña" está apagado en Firebase console → Authentication → Sign-in method. Actívalo primero.',
      'auth/too-many-requests': 'Demasiados intentos fallidos — espera un momento y vuelve a intentar.',
      'auth/network-request-failed': 'No hay conexión a internet, o no puede llegar a Firebase.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase console → Authentication → Settings → Authorized domains.',
    };
    errEl.textContent = mensajes[err.code] || `Error inesperado (${err.code||'sin código'}) — revisa la consola del navegador (F12).`;
  });
}

const SUBTAB_META = {
  insumos:{label:'Insumos', icon:'layers'},
  productos:{label:'Productos', icon:'tag'},
  pedidos:{label:'Pedidos', icon:'bag'},
  analisis:{label:'Análisis', icon:'trending'},
  balance:{label:'Balance', icon:'scale'},
  resumen:{label:'Resumen', icon:'clipboard'},
  historial:{label:'Historial de precios', icon:'tagsearch'},
  actividad:{label:'Registro de actividad', icon:'history'},
};
const GROUP_META = {
  inventario:{label:'Inventario', icon:'box', children:['insumos','productos']},
  reportes:{label:'Reportes', icon:'chart', children:['analisis','balance','resumen','historial','actividad']},
};
function tabLabel(id){ return (SUBTAB_META[id]||{}).label || id; }


function bottomNavIcon(id, iconName, label){
  return `<button class="bn-item ${tab===id?'active':''}" onclick="setBottomTab('${id}')" aria-label="${label}">${svgIcon(iconName)}</button>`;
}
function bottomNavGroupIcon(groupId, meta){
  const activeGroup = meta.children.includes(tab);
  const isOpen = navMenuOpen===groupId;
  return `<button class="bn-item ${activeGroup||isOpen?'active':''}" onclick="toggleNavMenu('${groupId}')" aria-label="${meta.label}">${svgIcon(meta.icon)}</button>`;
}
function renderBottomPopup(){
  if(!navMenuOpen) return '';
  const g = GROUP_META[navMenuOpen];
  if(!g) return '';
  return `
    <div class="bn-popup-overlay" onclick="closeNavMenu()"></div>
    <div class="bn-popup">
      <div class="bn-popup-title">${g.label}</div>
      <div class="bn-popup-grid">
        ${g.children.map(cid=>{
          const m = SUBTAB_META[cid];
          return `<button class="bn-popup-item ${tab===cid?'active':''}" onclick="setBottomTab('${cid}')">${svgIcon(m.icon)}<span>${m.label}</span></button>`;
        }).join('')}
      </div>
    </div>
  `;
}
function toggleNavMenu(id){ navMenuOpen = navMenuOpen===id ? null : id; render(); }
function closeNavMenu(){ navMenuOpen = null; render(); }
function setBottomTab(id){ tab=id; navMenuOpen=null; render(); window.scrollTo(0,0); }
function setTab(id){ tab=id; navMenuOpen=null; render(); }


function attachHandlers(){
}

document.addEventListener('click', (e)=>{
  if(rowMenuOpen && !e.target.closest('.row-menu')){
    rowMenuOpen = null; render();
  }
});
// Cualquier campo que el usuario toque (en cualquier pestaña, no solo en los formularios con botón "+")
// marca la pantalla como "sucia" para que la sincronización automática no la borre.
document.addEventListener('input', (e)=>{
  if(e.target.closest('#tab-content') || e.target.closest('.modal-box')) formDirty = true;
});
document.addEventListener('change', (e)=>{
  if(e.target.closest('#tab-content') || e.target.closest('.modal-box')) formDirty = true;
});

iniciarApp();
