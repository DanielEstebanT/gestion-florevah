/* ============================================================
   COMPONENTES DE INTERFAZ REUTILIZABLES
   Toasts, cuadros de confirmacion, modales con formulario,
   paginacion generica, e iconos SVG. Ninguna de estas funciones
   conoce insumos/productos/pedidos, solo dibujan UI generica.
   ============================================================ */

function toast(msg){
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${msg}</span><button class="toast-close" onclick="closeToast()" aria-label="Cerrar">✕</button>`;
  t.classList.add('show');
}
function closeToast(){
  const t = document.getElementById('toast');
  if(t) t.classList.remove('show');
}

/* ---------------- confirmación antes de guardar ---------------- */
let pendingConfirm = null;
function confirmarAntesDe(titulo, filasResumen, onConfirm, confirmLabel){
  pendingConfirm = onConfirm;
  const rowsHTML = filasResumen.map(([label,val])=>`<div class="ms-row"><span class="muted">${label}</span><span style="font-weight:600;text-align:right">${val}</span></div>`).join('');
  const old = document.getElementById('confirm-overlay');
  if(old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'confirm-overlay';
  overlay.onclick = (e)=>{ if(e.target===overlay) cancelarConfirm(); };
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Confirmar</h3>
      <div class="sub" style="margin-bottom:10px">${titulo}</div>
      <div class="modal-summary">${rowsHTML}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="cancelarConfirm()">${confirmLabel?'No':'Editar'}</button>
        <button class="btn ${confirmLabel==='Sí, eliminar'||confirmLabel==='Sí, cancelar'?'btn-danger':'btn-primary'}" onclick="ejecutarConfirm()">${confirmLabel||'Confirmar'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
function cancelarConfirm(){
  pendingConfirm = null;
  const el = document.getElementById('confirm-overlay');
  if(el) el.remove();
}
function ejecutarConfirm(){
  const fn = pendingConfirm;
  if(fn) fn();
  cancelarConfirm();
}

/* Modal con uno o varios campos, para reemplazar prompt() del navegador (no se ve bien ni es responsive en celular) */
function showFormModal(opts){
  const { titulo, fields, confirmLabel, onConfirm } = opts;
  const fieldsHTML = fields.map(f=>`
    <div class="field">
      <label>${f.label}</label>
      <input id="${f.id}" type="${f.type||'number'}" ${f.min!==undefined?`min="${f.min}"`:''} value="${f.value!==undefined?f.value:''}" placeholder="${f.placeholder||''}">
      ${f.helptext?`<div class="helptext">${f.helptext}</div>`:''}
    </div>
  `).join('');
  const old = document.getElementById('confirm-overlay');
  if(old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'confirm-overlay';
  overlay.onclick = (e)=>{ if(e.target===overlay) cancelarConfirm(); };
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>${titulo}</h3>
      ${fieldsHTML}
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="cancelarConfirm()">Cancelar</button>
        <button class="btn btn-primary" onclick="ejecutarConfirm()">${confirmLabel||'Confirmar'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  pendingConfirm = ()=>{
    const values = {};
    fields.forEach(f=>{ values[f.id] = document.getElementById(f.id).value; });
    onConfirm(values);
  };
}


/* Paginación genérica reutilizable para cualquier lista/tabla que crezca con el tiempo */
const PAGE_SIZE = 15;
function paginar(array, page){
  const totalPages = Math.max(1, Math.ceil(array.length / PAGE_SIZE));
  page = Math.min(Math.max(1, page), totalPages);
  const start = (page-1) * PAGE_SIZE;
  return { items: array.slice(start, start + PAGE_SIZE), page, totalPages, total: array.length };
}
function paginacionHTML(page, totalPages, onChangeFnName){
  if(totalPages<=1) return '';
  return `
    <div class="pagination">
      <button class="btn btn-ghost btn-sm" ${page<=1?'disabled':''} onclick="${onChangeFnName}(${page-1})">‹ Anterior</button>
      <span class="pagination-info">Página ${page} de ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" ${page>=totalPages?'disabled':''} onclick="${onChangeFnName}(${page+1})">Siguiente ›</button>
    </div>
  `;
}


function svgIcon(name){
  const icons = {
    home: `<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>`,
    box: `<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>`,
    bag: `<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>`,
    chart: `<path d="M4 20V10"/><path d="M11 20V4"/><path d="M18 20v-7"/><path d="M3 20h18"/>`,
    layers: `<path d="M12 3 2 9l10 6 10-6-10-6z"/><path d="M2 15l10 6 10-6"/>`,
    tag: `<path d="M20 12 12 20l-9-9V4h7l10 8z"/><circle cx="7.5" cy="7.5" r="1.2"/>`,
    calendar: `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>`,
    receipt: `<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>`,
    trending: `<path d="M4 16l6-6 4 4 6-8"/><path d="M20 6h-4v4"/>`,
    scale: `<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2 13a3 3 0 0 0 6 0L5 7z"/><path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6z"/>`,
    clipboard: `<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>`,
    history: `<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>`,
    tagsearch: `<path d="M20 12 12 20l-9-9V4h7l10 8z"/><circle cx="7.5" cy="7.5" r="1.2"/><path d="M14 14l3 3"/>`,
    dots: `<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>`,
    eye: `<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`,
    'eye-off': `<path d="M3 3l18 18"/><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.4 4.3M6.5 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1"/><path d="M9.5 9.6a3 3 0 0 0 4.2 4.2"/>`,
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.tag}</svg>`;
}


function brandMark(){
  return `<svg class="brand-mark" viewBox="0 0 40 40" fill="none">
    ${[0,72,144,216,288].map((a,i)=>`<ellipse cx="20" cy="12" rx="6" ry="9" fill="${i%2?'#A57BC4':'#EDA0C0'}" opacity="0.9" transform="rotate(${a} 20 20)"/>`).join('')}
    <circle cx="20" cy="20" r="5" fill="#E8C6EA"/>
  </svg>`;
}
