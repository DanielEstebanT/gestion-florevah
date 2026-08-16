/* ============================================================
   ORQUESTADOR PRINCIPAL
   render(), navegacion (nav inferior + submenus), y el arranque
   de la app. Este archivo debe cargarse SIEMPRE de ultimo, porque
   dispara loadState() que a su vez llama render() usando todo
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
  formDirty = false; // cada render() real vuelve a dejar la pantalla "limpia"
  app.innerHTML = `
    <div class="topbar">
      <div class="brand">
        ${brandMark()}
        <div class="brand-text"><div class="name">florevah</div><div class="tag">Costeo e inventario</div></div>
      </div>
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

loadState();
