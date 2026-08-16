/* ============================================================
   PESTANA: REGISTRO DE ACTIVIDAD
   ============================================================ */

let actividadFiltroEntidad = 'todos';
let actividadFiltroAccion = 'todos';
let actividadPage = 1;
const ENTIDAD_META = {
  insumo:{label:'Insumo', cls:'pill-pink'},
  producto:{label:'Producto', cls:'pill-lilac'},
  compra:{label:'Compra', cls:'pill-pink'},
  fabricacion:{label:'Fabricación', cls:'pill-lilac'},
  pedido:{label:'Pedido', cls:'pill-mauve'},
  venta:{label:'Venta', cls:'pill-mauve'},
  movimiento:{label:'Balance', cls:'pill-rose'},
  respaldo:{label:'Respaldo', cls:'pill-rose'},
};
const ACCION_META = {
  agregar:'Agregado', editar:'Editado', eliminar:'Eliminado', registrar:'Registrado',
  cancelar:'Cancelado', entregar:'Entregado', abonar:'Abono',
};
function renderActividad(){
  const entidadesPresentes = [...new Set(state.actividad.map(a=>a.entidad))];
  const accionesPresentes = [...new Set(state.actividad.map(a=>a.accion))];
  const filtered = state.actividad.filter(a=>
    (actividadFiltroEntidad==='todos'||a.entidad===actividadFiltroEntidad) &&
    (actividadFiltroAccion==='todos'||a.accion===actividadFiltroAccion)
  ).slice().reverse();
  const { items: pageItems, page, totalPages, total } = paginar(filtered, actividadPage);
  actividadPage = page;

  const chipEntidad = (v,label) => `<button class="filter-chip ${actividadFiltroEntidad===v?'active':''}" onclick="setActividadFiltro('entidad','${v}')">${label}</button>`;
  const chipAccion = (v,label) => `<button class="filter-chip ${actividadFiltroAccion===v?'active':''}" onclick="setActividadFiltro('accion','${v}')">${label}</button>`;

  const filas = pageItems.map(a=>{
    const em = ENTIDAD_META[a.entidad] || {label:a.entidad, cls:'status-ok'};
    return `
    <div class="actividad-row">
      <div class="actividad-meta">
        <span class="status-pill ${em.cls}">${em.label}</span>
        <span class="status-pill" style="background:var(--gold-bg);color:var(--lilac-deep)">${ACCION_META[a.accion]||a.accion}</span>
        <span class="caption">${a.hora||a.fecha}</span>
      </div>
      <div class="actividad-resumen">${a.resumen}</div>
    </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="section-head"><div><h2>Registro de actividad</h2><div class="sub">Todo lo que se ha agregado, editado, eliminado o registrado en la app, con filtros. ${total>0?`(${total} en total)`:''}</div></div></div>
      <div class="muted" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:6px 0 4px">Qué</div>
      <div class="search-row">
        ${chipEntidad('todos','Todo')}
        ${entidadesPresentes.map(e=>chipEntidad(e, (ENTIDAD_META[e]||{label:e}).label)).join('')}
      </div>
      <div class="muted" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px">Acción</div>
      <div class="search-row">
        ${chipAccion('todos','Todas')}
        ${accionesPresentes.map(ac=>chipAccion(ac, ACCION_META[ac]||ac)).join('')}
      </div>
    </div>
    <div class="card">
      ${filtered.length===0?`<div class="empty">No hay actividad con estos filtros.</div>`:`<div class="actividad-list">${filas}</div>${paginacionHTML(page, totalPages, 'setActividadPage')}`}
    </div>
  `;
}
function setActividadFiltro(cual, v){
  if(cual==='entidad') actividadFiltroEntidad=v; else actividadFiltroAccion=v;
  actividadPage = 1;
  render();
}
function setActividadPage(p){ actividadPage = p; render(); window.scrollTo(0,0); }
