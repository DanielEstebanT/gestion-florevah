/* ============================================================
   PESTANA: INSUMOS
   ============================================================ */

let insumoSearch = '', insumoOrigenFilter = 'todos';

function renderInsumos(){
  const filtered = state.insumos.filter(i=>{
    const matchSearch = i.nombre.toLowerCase().includes(insumoSearch.toLowerCase());
    const matchOrigen = insumoOrigenFilter==='todos' || i.origen===insumoOrigenFilter;
    return matchSearch && matchOrigen;
  });
  const cards = filtered.map(i=>{
    const st = stockStatus(i);
    const pillClass = st==='ok'?'status-ok':st==='low'?'status-low':'status-out';
    const pillText = st==='ok'?'Bien':st==='low'?'Bajo':'Agotado';
    const menuOpen = rowMenuOpen === 'ins-'+i.id;
    return `
    <div class="insumo-card">
      <div class="pedido-card-head">
        <div>
          <div class="pedido-cliente">${i.nombre}</div>
          <div style="margin-top:3px">
            <span class="origen-pill origen-${i.origen}">${i.origen==='local'?'Mercado local':'Mercado extranjero'}</span>
            ${i.distribuidor?`<span class="caption"> · ${i.distribuidor}</span>`:''}
          </div>
        </div>
        <div class="row-menu">
          <button class="btn btn-ghost btn-sm row-menu-btn" onclick="toggleRowMenu('ins-${i.id}')" aria-label="Más acciones">⋮</button>
          ${menuOpen?`<div class="row-menu-dropdown">
            <button onclick="closeRowMenu(); editInsumo('${i.id}')">Editar</button>
            <button onclick="closeRowMenu(); openCompra('${i.id}')">+ Compra</button>
            <button class="danger" onclick="closeRowMenu(); deleteInsumo('${i.id}')">Eliminar</button>
          </div>`:''}
        </div>
      </div>
      <div class="divider" style="margin:10px 0"></div>
      <div class="insumo-money-grid">
        <div><div class="pedido-money-label">Stock</div><div class="insumo-money-val">${i.stockActual} ${i.unidad}</div></div>
        <div><div class="pedido-money-label">Total comprado</div><div class="insumo-money-val">${fmt(i.precioTotalComprado)}</div></div>
        <div><div class="pedido-money-label">Costo unidad</div><div class="insumo-money-val">${fmt(i.precioUnidad)}</div></div>
      </div>
      <div class="pedido-card-row" style="margin-top:10px">
        ${flowerGauge(st)} <span class="status-pill ${pillClass}">${pillText}</span>
      </div>
      <div class="insumo-controls">
        <div class="field" style="margin-bottom:0">
          <label>Umbral de alerta</label>
          <input type="number" min="0" step="1" value="${i.stockMinimo}" onchange="updateUmbral('${i.id}', this.value)">
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Prioridad de compra</label>
          <select onchange="updatePrioridad('${i.id}', this.value)">
            <option value="bajo" ${i.prioridad==='bajo'?'selected':''}>Bajo</option>
            <option value="medio" ${(!i.prioridad||i.prioridad==='medio')?'selected':''}>Medio</option>
            <option value="alto" ${i.prioridad==='alto'?'selected':''}>Alto</option>
          </select>
        </div>
      </div>
    </div>`;
  }).join('');

  const lowCount = state.insumos.filter(i=>stockStatus(i)!=='ok').length;

  return `
    <div class="card">
      <div class="section-head">
        <div><h2>Insumos</h2><div class="sub">Lo que compras para producir. ${lowCount>0?`<b style="color:var(--red)">${lowCount} necesitan reposición.</b>`:'Todo en buen nivel.'}</div></div>
        <button class="btn btn-primary" onclick="toggleAddInsumo()">+ Nuevo insumo</button>
      </div>
      <div id="add-insumo-form"></div>
      <div class="divider"></div>
      <div class="search-row">
        <input type="search" placeholder="Buscar insumo…" value="${insumoSearch}" oninput="setInsumoSearch(this.value)">
        <button class="filter-chip ${insumoOrigenFilter==='todos'?'active':''}" onclick="setInsumoFiltro('todos')">Todos</button>
        <button class="filter-chip ${insumoOrigenFilter==='local'?'active':''}" onclick="setInsumoFiltro('local')">Mercado local</button>
        <button class="filter-chip ${insumoOrigenFilter==='extranjero'?'active':''}" onclick="setInsumoFiltro('extranjero')">Mercado extranjero</button>
      </div>
    </div>
    ${filtered.length===0?`<div class="card"><div class="empty">No hay insumos que coincidan.</div></div>`:`<div class="pedido-list">${cards}</div>`}
  `;
}
function setInsumoSearch(v){
  insumoSearch=v; render();
  const el = document.querySelector('.search-row input[type=search]');
  if(el){ el.focus(); const len=el.value.length; el.setSelectionRange(len,len); }
}
function setInsumoFiltro(v){ insumoOrigenFilter=v; render(); }
function flowerGauge(status){
  const colors = status==='ok' ? ['#9B6FB5','#9B6FB5','#9B6FB5','#9B6FB5','#9B6FB5']
    : status==='low' ? ['#E7B673','#E7B673','#E7B673','#E9DAEE','#E9DAEE']
    : ['#C4645F','#E9DAEE','#E9DAEE','#E9DAEE','#E9DAEE'];
  return `<span class="flower">${colors.map(c=>`<span class="petal" style="background:${c}"></span>`).join('')}</span>`;
}
function toggleAddInsumo(){
  const el = document.getElementById('add-insumo-form');
  if(el.innerHTML && !el.dataset.editId){ el.innerHTML=''; return; }
  openInsumoForm();
}
function openInsumoForm(existing){
  const el = document.getElementById('add-insumo-form');
  el.dataset.editId = existing ? existing.id : '';
  const i = existing || { nombre:'', unidad:'', distribuidor:'', origen:'local', prioridad:'medio', stockMinimo:5 };
  el.innerHTML = `
    <div class="divider"></div>
    <div class="grid3" style="margin-top:6px">
      <div class="field"><label>Nombre</label><input id="ni-nombre" type="text" placeholder="Ej. Cinta dorada" value="${i.nombre}"></div>
      <div class="field"><label>Unidad</label><input id="ni-unidad" type="text" placeholder="metros, unidades, gramos..." value="${i.unidad}"></div>
      <div class="field"><label>Distribuidor (opcional)</label><input id="ni-dist" type="text" placeholder="Shein, Temu..." value="${i.distribuidor}"></div>
      ${existing? '' : `
      <div class="field"><label>Cantidad comprada</label><input id="ni-cant" type="number" min="0" step="any"></div>
      <div class="field"><label>Precio total pagado</label><input id="ni-precio" type="number" min="0" step="any"></div>
      `}
      <div class="field"><label>Umbral mínimo de alerta</label><input id="ni-umbral" type="number" min="0" step="1" value="${i.stockMinimo}"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>¿Dónde lo compras?</label>
        <select id="ni-origen">
          <option value="local" ${i.origen==='local'?'selected':''}>Mercado local</option>
          <option value="extranjero" ${i.origen==='extranjero'?'selected':''}>Mercado extranjero</option>
        </select>
      </div>
      <div class="field"><label>Prioridad de compra</label>
        <select id="ni-prioridad">
          <option value="bajo" ${i.prioridad==='bajo'?'selected':''}>Bajo</option>
          <option value="medio" ${i.prioridad==='medio'?'selected':''}>Medio</option>
          <option value="alto" ${i.prioridad==='alto'?'selected':''}>Alto</option>
        </select>
      </div>
    </div>
    ${existing? `<div class="field" style="max-width:220px"><label>Corregir stock actual</label><input id="ni-stock-actual" type="number" step="any" value="${existing.stockActual}"></div>
    <div class="helptext">Esto solo corrige el stock disponible — no cambia el costo por unidad ni el histórico de compras. Para eso usa "+ Compra".</div>` :
    `<div class="helptext">El costo por unidad se calcula solo: precio total ÷ cantidad.</div>`}
    <button class="btn btn-primary" style="margin-top:10px" onclick="saveInsumo()">${existing?'Guardar cambios':'Guardar insumo'}</button>
    ${existing? `<button class="btn btn-ghost" style="margin-top:10px" onclick="closeInsumoForm()">Cancelar</button>` : ''}
  `;
}
function closeInsumoForm(){ const el=document.getElementById('add-insumo-form'); el.innerHTML=''; el.dataset.editId=''; }
function saveInsumo(){
  const nombre = document.getElementById('ni-nombre').value.trim();
  const unidad = document.getElementById('ni-unidad').value.trim() || 'unidades';
  const dist = document.getElementById('ni-dist').value.trim();
  const umbral = parseFloat(document.getElementById('ni-umbral').value)||0;
  const origen = document.getElementById('ni-origen').value;
  const prioridad = document.getElementById('ni-prioridad').value;
  if(!nombre){ toast('Ponle un nombre al insumo'); return; }
  const editId = document.getElementById('add-insumo-form').dataset.editId;
  if(editId){
    const i = state.insumos.find(x=>x.id===editId);
    if(!i) return;
    const stockActualInput = document.getElementById('ni-stock-actual');
    const nuevoStock = stockActualInput ? (parseFloat(stockActualInput.value)||0) : i.stockActual;
    confirmarAntesDe('Vas a guardar estos cambios en el insumo:', [
      ['Nombre', nombre],
      ['Unidad', unidad],
      ['Stock actual', `${nuevoStock} ${unidad}`],
      ['Umbral de alerta', `${umbral} ${unidad}`],
      ['Origen', origen==='local'?'Mercado local':'Mercado extranjero'],
    ], ()=>{
      i.nombre=nombre; i.unidad=unidad; i.distribuidor=dist; i.origen=origen; i.prioridad=prioridad; i.stockMinimo=umbral;
      i.stockActual = nuevoStock;
      logActividad('insumo','editar', `Insumo editado: ${nombre}`);
      guardarInsumo(i); toast('Insumo actualizado'); closeInsumoForm(); render();
    });
  } else {
    const cant = parseFloat(document.getElementById('ni-cant').value)||0;
    const precio = parseFloat(document.getElementById('ni-precio').value)||0;
    const precioUnidad = cant? +(precio/cant).toFixed(2):0;
    confirmarAntesDe('Vas a agregar este insumo nuevo:', [
      ['Nombre', nombre],
      ['Unidad', unidad],
      ['Cantidad comprada', `${cant} ${unidad}`],
      ['Precio total pagado', fmt(precio)],
      ['Costo por unidad', fmt(precioUnidad)],
      ['Umbral de alerta', `${umbral} ${unidad}`],
      ['Origen', origen==='local'?'Mercado local':'Mercado extranjero'],
    ], ()=>{
      const nuevo = { nombre, unidad, origen, prioridad, stockActual: cant, cantidadComprada: cant, precioTotalComprado: precio, precioUnidad, distribuidor: dist, stockMinimo: umbral };
      guardarInsumo(nuevo); // asigna nuevo.id al vuelo (id real de Firestore)
      state.insumos.push(nuevo); // optimista: se ve al instante, onSnapshot lo confirma después
      logPrecio('insumo', nuevo.id, nombre, null, precioUnidad, 'Precio inicial');
      logActividad('insumo','agregar', `Insumo agregado: ${nombre}`);
      toast('Insumo agregado'); render();
    });
  }
}
function editInsumo(id){
  const i = state.insumos.find(x=>x.id===id); if(!i) return;
  openInsumoForm(i);
  document.getElementById('add-insumo-form').scrollIntoView({behavior:'smooth'});
}
function updateUmbral(id,val){
  const i = state.insumos.find(x=>x.id===id); if(!i) return;
  i.stockMinimo = parseFloat(val)||0;
  db.collection('insumos').doc(id).update({ stockMinimo: i.stockMinimo }).catch(err=>console.error('Error actualizando umbral:', err));
}
function updatePrioridad(id,val){
  const i = state.insumos.find(x=>x.id===id); if(!i) return;
  i.prioridad = val;
  db.collection('insumos').doc(id).update({ prioridad: val }).catch(err=>console.error('Error actualizando prioridad:', err));
}
function deleteInsumo(id){
  const i = state.insumos.find(x=>x.id===id); if(!i) return;
  confirmarAntesDe('¿Eliminar este insumo?', [
    ['Nombre', i.nombre],
    ['Advertencia', 'No afecta recetas ya guardadas, pero dejarán de calcular su costo con este insumo.'],
  ], ()=>{
    state.insumos = state.insumos.filter(x=>x.id!==id);
    eliminarInsumoDoc(id);
    logActividad('insumo','eliminar', `Insumo eliminado: ${i.nombre}`);
    render();
  }, 'Sí, eliminar');
}
function openCompra(id){
  const i = state.insumos.find(x=>x.id===id); if(!i) return;
  showFormModal({
    titulo: `Registrar compra de "${i.nombre}"`,
    fields: [
      { id:'fm-compra-cant', label:`¿Cuántas ${i.unidad} compraste?`, type:'number', min:0 },
      { id:'fm-compra-precio', label:'¿Cuánto pagaste en total?', type:'number', min:0 },
    ],
    confirmLabel: 'Registrar compra',
    onConfirm: (vals)=>{
      const cant = parseFloat(vals['fm-compra-cant']);
      const precio = parseFloat(vals['fm-compra-precio']);
      if(!cant || cant<=0 || isNaN(precio)){ toast('Completa cantidad y precio válidos'); return; }
      const precioUnidadAntes = i.precioUnidad;
      const precioEstaCompra = +(precio/cant).toFixed(2);
      // Optimista en local para que se vea al instante — el valor EXACTO lo calcula
      // la transacción de Firestore (a prueba de que compren dos cosas a la vez).
      i.stockActual = +(i.stockActual + cant).toFixed(4);
      i.cantidadComprada = +(i.cantidadComprada + cant).toFixed(4);
      i.precioTotalComprado = +(i.precioTotalComprado + precio).toFixed(2);
      i.precioUnidad = i.cantidadComprada ? +(i.precioTotalComprado/i.cantidadComprada).toFixed(2) : 0;
      registrarCompraInsumoDB(i.id, cant, precio);
      logPrecio('insumo', i.id, i.nombre, precioUnidadAntes, precioEstaCompra, `Compra de ${cant} ${i.unidad} a ${fmt(precioEstaCompra)}/${i.unidad.replace(/s$/,'')}${i.distribuidor?' — '+i.distribuidor:''}`);
      logActividad('compra','registrar', `Compra: ${cant} ${i.unidad} de ${i.nombre} por ${fmt(precio)}`);
      toast('Compra registrada — costo unitario actualizado'); render();
    }
  });
}
