/* ============================================================
   PESTANA: PRODUCTOS
   ============================================================ */

let productoSearch = '';

let recetaMPBuilder = [];
let recetaEmpBuilder = [];
let variantesBuilder = [];
function renderProductos(){
  const filtered = state.productos.filter(p=>p.nombre.toLowerCase().includes(productoSearch.toLowerCase()));
  const cards = filtered.map(p=>{
    const mp = materiaPrima(p), emp = empaqueCosto(p), sub = subtotal(p);
    const mpTxt = p.receta.length ? p.receta.map(r=>{
      const ins = state.insumos.find(i=>i.id===r.insumoId);
      return ins ? `${r.cantidad} ${ins.unidad} de ${ins.nombre}${varianteInsumo(ins,r.varianteId)?' — '+varianteInsumo(ins,r.varianteId).nombre:''}` : '';
    }).join(', ') : 'materia prima manual';
    const empTxt = p.recetaEmpaque.length ? p.recetaEmpaque.map(r=>{
      const ins = state.insumos.find(i=>i.id===r.insumoId);
      return ins ? `${r.cantidad} ${ins.unidad} de ${ins.nombre}${varianteInsumo(ins,r.varianteId)?' — '+varianteInsumo(ins,r.varianteId).nombre:''}` : '';
    }).join(', ') : 'empaque manual';
    return `
    <div class="product-card">
      <div class="product-head">
        <div>
          <div class="pedido-cliente">${p.nombre} ${p.wholesale?'<span class="badge-wholesale">Al por mayor</span>':''}</div>
          <div class="caption" style="margin-top:2px">Receta: ${mpTxt}</div>
          <div class="caption">Empaque: ${empTxt}</div>
          ${(!p.variantes||!p.variantes.length) ? `<div style="margin-top:6px"><span class="status-pill ${(p.stock||0)>0?'status-ok':'status-out'}">Stock: ${p.stock||0} u.</span> <button class="btn btn-ghost btn-sm" onclick="fabricarPrompt('${p.id}', null)">+ Fabricar</button></div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" onclick="editProducto('${p.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProducto('${p.id}')">Eliminar</button>
        </div>
      </div>
      <div class="divider"></div>
      <div class="grid2">
        <div>
          <div class="cost-row"><span>Materia prima</span><span>${fmt(mp)}</span></div>
          <div class="cost-row"><span>Desgaste herramientas</span><span>${fmt(p.desgasteHerramientas)}</span></div>
          <div class="cost-row"><span>Empaque</span><span>${fmt(emp)}</span></div>
          <div class="cost-row"><span>Mano de obra</span><span>${fmt(p.manoObra)}</span></div>
          <div class="cost-row total"><span>Subtotal (costo)</span><span>${fmt(sub)}</span></div>
        </div>
        <div>
          <div class="cost-row"><span>Sugerido 50%</span><span>${fmt(sub*1.5)}</span></div>
          <div class="cost-row"><span>Sugerido 100%</span><span>${fmt(sub*2)}</span></div>
          <div class="cost-row"><span>Sugerido 200%</span><span>${fmt(sub*3)}</span></div>
          <div class="cost-row total"><span>Precio de venta actual</span><span>${fmt(p.precioFinal)}</span></div>
          <div class="cost-row"><span>Ganancia estándar</span><span>${fmt(p.precioFinal-sub)}</span></div>
        </div>
      </div>
      ${p.wholesale? `<div class="helptext">Aliados: ${p.tiers.map(t=>`${t.unidades}+ u. → -${t.pct}% (${fmt(p.precioFinal*(1-t.pct/100))})`).join(' · ')}</div>`:''}
      ${(p.variantes&&p.variantes.length) ? `
      <div class="divider"></div>
      <div class="caption" style="font-weight:600;margin-bottom:6px">Variantes (mismo precio, distinto material)</div>
      ${p.variantes.map(v=>{
        const extraTxt = v.receta.map(r=>{
          const ins = state.insumos.find(i=>i.id===r.insumoId);
          return ins ? `${r.cantidad} ${ins.unidad} de ${ins.nombre}${varianteInsumo(ins,r.varianteId)?' — '+varianteInsumo(ins,r.varianteId).nombre:''}` : '';
        }).join(', ') || 'sin insumos extra';
        return `<div class="cost-row"><span>${v.nombre}</span><span class="muted" style="font-weight:400">${extraTxt} · materia prima total ${fmt(materiaPrimaTotal(p,v))}</span></div>
        <div style="margin:2px 0 8px"><span class="status-pill ${(v.stock||0)>0?'status-ok':'status-out'}">Stock: ${v.stock||0} u.</span> <button class="btn btn-ghost btn-sm" onclick="fabricarPrompt('${p.id}', '${v.id}')">+ Fabricar</button></div>`;
      }).join('')}
      `:''}
    </div>`;
  }).join('');

  return `
    <div class="card">
      <div class="section-head">
        <div><h2>Productos</h2><div class="sub">Primero la receta, luego los costos fijos, y al final decides el precio.</div></div>
        <button class="btn btn-primary" onclick="openProductoForm()">+ Nuevo producto</button>
      </div>
      <div id="producto-form"></div>
      <div class="divider"></div>
      <div class="search-row"><input type="search" placeholder="Buscar producto…" value="${productoSearch}" oninput="setProductoSearch(this.value)"></div>
    </div>
    ${filtered.length===0?`<div class="card"><div class="empty">No hay productos que coincidan.</div></div>`: cards}
  `;
}
function setProductoSearch(v){
  productoSearch=v; render();
  const el = document.querySelector('#tab-content .search-row input[type=search]');
  if(el){ el.focus(); const len=el.value.length; el.setSelectionRange(len,len); }
}

function insumoOptionsHTML(filter){
  const term=(filter||'').toLowerCase();
  return state.insumos.filter(i=>(i.nombre||'').toLowerCase().includes(term)).map(i=>`<option value="${i.id}">${i.nombre} (${fmt(i.precioUnidad||0)}/${i.unidad})${insumoTieneVariantes(i)?' · variantes':''}</option>`).join('') || `<option value="" disabled selected>Sin resultados</option>`;
}
function insumoVariantOptionsHTML(insumoId, selectedId){
  const ins=state.insumos.find(i=>i.id===insumoId);
  if(!insumoTieneVariantes(ins)) return `<option value="">Sin variante</option>`;
  return `<option value="" ${!selectedId?'selected':''}>Elige variante…</option>` + (ins.variantes||[]).filter(v=>v.activa!==false).map(v=>`<option value="${v.id}" ${v.id===selectedId?'selected':''}>${v.nombre} (${v.stockActual||0} ${ins.unidad})</option>`).join('');
}
function renderRecipeVariantSelect(kind, selectedId){
  const insumoId=document.getElementById(kind+'-insumo')?.value;
  const wrap=document.getElementById(kind+'-variante-wrap'), sel=document.getElementById(kind+'-variante');
  if(!wrap||!sel)return;
  const ins=state.insumos.find(i=>i.id===insumoId);
  if(!insumoTieneVariantes(ins)){wrap.style.display='none';sel.innerHTML='<option value="">Sin variante</option>';sel.value='';return;}
  wrap.style.display='';sel.innerHTML=insumoVariantOptionsHTML(insumoId,selectedId);if(selectedId)sel.value=selectedId;
}
function filterInsumoSelect(kind){
  const term=document.getElementById(kind+'-insumo-search').value, sel=document.getElementById(kind+'-insumo'), prev=sel.value;
  sel.innerHTML=insumoOptionsHTML(term); if([...sel.options].some(o=>o.value===prev))sel.value=prev;
  renderRecipeVariantSelect(kind);
}
function openProductoForm(existing){
  recetaMPBuilder = existing ? JSON.parse(JSON.stringify(existing.receta)) : [];
  recetaEmpBuilder = existing ? JSON.parse(JSON.stringify(existing.recetaEmpaque)) : [];
  variantesBuilder = existing && existing.variantes ? JSON.parse(JSON.stringify(existing.variantes)) : [];
  const p = existing || { nombre:'', desgasteHerramientas:0, manoObra:0, precioFinal:0, materiaPrimaManual:0, empaqueManual:0, variantes:[], wholesale:false, tiers:[{unidades:12,pct:10},{unidades:24,pct:20}] };
  const el = document.getElementById('producto-form');
  el.dataset.editId = existing ? existing.id : '';
  el.innerHTML = `
    <div class="divider"></div>
    <div class="field"><label>Nombre del producto</label><input id="pf-nombre" type="text" value="${p.nombre}"></div>

    <div class="recipe-block">
      <label>1. Receta — materia prima que usa</label>
      <div id="mp-chips">${chipsHTML('mp', recetaMPBuilder)}</div>
      <div class="field" style="margin-bottom:8px"><label>Buscar insumo</label><input type="text" id="mp-insumo-search" placeholder="Escribe para filtrar…" oninput="filterInsumoSelect('mp')"></div>
      <div class="grid3" style="align-items:end">
        <div class="field" style="margin-bottom:0"><label>Insumo</label><select id="mp-insumo" onchange="renderRecipeVariantSelect('mp')">${insumoOptionsHTML()}</select></div>
        <div class="field" id="mp-variante-wrap" style="margin-bottom:0;display:none"><label>Variante</label><select id="mp-variante"></select></div>
        <div class="field" style="margin-bottom:0"><label>Cantidad usada</label><input id="mp-cant" type="text" placeholder="Ej: 1/3 o 0.5"></div>
        <button class="btn btn-ghost" onclick="addRecetaItem('mp')">Agregar</button>
      </div>
      <div class="field" style="margin-top:10px;margin-bottom:0"><label>O costo de materia prima manual (si no armas receta)</label><input id="pf-manual" type="number" min="0" value="${p.materiaPrimaManual||0}" oninput="updatePreview()"></div>
    </div>

    <div class="recipe-block">
      <div class="section-head" style="margin-bottom:8px">
        <label style="margin:0">Variantes (opcional) — mismo precio, distinto material. Ej: gorro tiburón, gorro oso…</label>
        <button class="btn btn-ghost btn-sm" onclick="addVariant()">+ Variante</button>
      </div>
      <div class="helptext" style="margin-bottom:8px">Úsalo cuando un producto tiene versiones que gastan insumos distintos (otro color, otro accesorio) pero se venden al mismo precio. La receta de arriba es la base común; aquí agregas solo lo que cambia en cada variante.</div>
      <div id="variantes-container"></div>
    </div>

    <div class="field"><label>2. Desgaste de herramientas</label><input id="pf-herr" type="number" min="0" value="${p.desgasteHerramientas}" oninput="updatePreview()"></div>

    <div class="recipe-block">
      <label>3. Receta de empaque — bolsas, cintas, cajas, etc.</label>
      <div id="emp-chips">${chipsHTML('emp', recetaEmpBuilder)}</div>
      <div class="field" style="margin-bottom:8px"><label>Buscar insumo</label><input type="text" id="emp-insumo-search" placeholder="Escribe para filtrar…" oninput="filterInsumoSelect('emp')"></div>
      <div class="grid3" style="align-items:end">
        <div class="field" style="margin-bottom:0"><label>Insumo</label><select id="emp-insumo" onchange="renderRecipeVariantSelect('emp')">${insumoOptionsHTML()}</select></div>
        <div class="field" id="emp-variante-wrap" style="margin-bottom:0;display:none"><label>Variante</label><select id="emp-variante"></select></div>
        <div class="field" style="margin-bottom:0"><label>Cantidad usada</label><input id="emp-cant" type="text" placeholder="Ej: 1/3 o 0.5"></div>
        <button class="btn btn-ghost" onclick="addRecetaItem('emp')">Agregar</button>
      </div>
      <div class="field" style="margin-top:10px;margin-bottom:0"><label>O costo de empaque manual (si no armas receta)</label><input id="pf-emp-manual" type="number" min="0" value="${p.empaqueManual||0}" oninput="updatePreview()"></div>
    </div>

    <div class="field"><label>4. Mano de obra (monto fijo)</label><input id="pf-mano" type="number" min="0" value="${p.manoObra}" oninput="updatePreview()"></div>

    <div class="preview-box" id="preview-box"></div>

    <div class="field"><label>5. Precio de venta actual — el que decides con base en lo sugerido arriba</label><input id="pf-precio" type="number" min="0" value="${p.precioFinal}"></div>

    <div class="toggle-row">
      <input type="checkbox" id="pf-mayor" ${p.wholesale?'checked':''} style="width:auto">
      <label style="margin:0">Se vende al por mayor / a aliados</label>
    </div>
    <div id="mayor-tiers" style="${p.wholesale?'':'display:none'}">
      <div class="grid2">
        <div class="field"><label>Unidades mínimas · Nivel 1</label><input id="pf-t1u" type="number" value="${p.tiers[0]?.unidades??12}"></div>
        <div class="field"><label>% descuento · Nivel 1</label><input id="pf-t1p" type="number" value="${p.tiers[0]?.pct??10}"></div>
        <div class="field"><label>Unidades mínimas · Nivel 2</label><input id="pf-t2u" type="number" value="${p.tiers[1]?.unidades??24}"></div>
        <div class="field"><label>% descuento · Nivel 2</label><input id="pf-t2p" type="number" value="${p.tiers[1]?.pct??20}"></div>
      </div>
    </div>

    <button class="btn btn-primary" style="margin-top:10px" onclick="saveProducto()">Guardar producto</button>
    <button class="btn btn-ghost" style="margin-top:10px" onclick="closeProductoForm()">Cancelar</button>
  `;
  document.getElementById('pf-mayor').onchange = e => {
    document.getElementById('mayor-tiers').style.display = e.target.checked ? '' : 'none';
  };
  renderVariantesSection();
  renderRecipeVariantSelect('mp');
  renderRecipeVariantSelect('emp');
  updatePreview();
}
function renderVariantesSection(){
  const cont = document.getElementById('variantes-container');
  if(!cont) return;
  if(variantesBuilder.length===0){
    cont.innerHTML = `<div class="helptext">Sin variantes — este producto usa solo la receta base.</div>`;
    return;
  }
  cont.innerHTML = variantesBuilder.map(v=>{
    const kind = 'var-'+v.id;
    return `
    <div class="card" style="padding:14px;margin-bottom:10px;background:#fff">
      <div class="section-head" style="margin-bottom:8px">
        <div class="field" style="margin-bottom:0;flex:1"><label>Nombre de la variante</label><input type="text" value="${v.nombre}" placeholder="Ej: gorro tiburón" oninput="updateVariantNombre('${v.id}', this.value)"></div>
        <button class="btn btn-danger btn-sm" onclick="removeVariant('${v.id}')">Eliminar variante</button>
      </div>
      <label>Insumos extra de esta variante</label>
      <div id="${kind}-chips">${chipsHTML(kind, v.receta)}</div>
      <div class="field" style="margin-bottom:8px"><label>Buscar insumo</label><input type="text" id="${kind}-insumo-search" placeholder="Escribe para filtrar…" oninput="filterInsumoSelect('${kind}')"></div>
      <div class="grid3" style="align-items:end">
        <div class="field" style="margin-bottom:0"><label>Insumo</label><select id="${kind}-insumo" onchange="renderRecipeVariantSelect('${kind}')">${insumoOptionsHTML()}</select></div>
        <div class="field" id="${kind}-variante-wrap" style="margin-bottom:0;display:none"><label>Variante</label><select id="${kind}-variante"></select></div>
        <div class="field" style="margin-bottom:0"><label>Cantidad usada</label><input id="${kind}-cant" type="text" placeholder="Ej: 1/3 o 0.5"></div>
        <button class="btn btn-ghost" onclick="addRecetaItem('${kind}')">Agregar</button>
      </div>
    </div>`;
  }).join('');
  variantesBuilder.forEach(v=>renderRecipeVariantSelect('var-'+v.id));
}
function addVariant(){
  variantesBuilder.push({id: uid(), nombre:'', receta: []});
  renderVariantesSection();
}
function removeVariant(vid){
  variantesBuilder = variantesBuilder.filter(v=>v.id!==vid);
  renderVariantesSection();
}
function updateVariantNombre(vid, val){
  const v = variantesBuilder.find(x=>x.id===vid);
  if(v) v.nombre = val;
}
function chipsHTML(kind,list){
  if(!list.length)return `<div class="helptext" style="margin:6px 0">Sin insumos agregados aún.</div>`;
  return list.map((r,idx)=>{const ins=state.insumos.find(i=>i.id===r.insumoId);const v=varianteInsumo(ins,r.varianteId);return `<span class="chip">${r.cantidad} ${ins?.unidad||''} · ${ins?.nombre||'—'}${v?' — '+v.nombre:''} <button onclick="removeRecetaItem('${kind}',${idx})">✕</button></span>`;}).join('');
}
function getBuilderArray(kind){
  if(kind==='mp') return recetaMPBuilder;
  if(kind==='emp') return recetaEmpBuilder;
  if(kind.startsWith('var-')){
    const vid = kind.slice(4);
    const v = variantesBuilder.find(x=>x.id===vid);
    return v ? v.receta : [];
  }
  return [];
}
function addRecetaItem(kind){
  const insumoId=document.getElementById(kind+'-insumo').value;
  const cantidad=parseCantidad(document.getElementById(kind+'-cant').value);
  const ins=state.insumos.find(i=>i.id===insumoId);
  const varianteId=document.getElementById(kind+'-variante')?.value||null;
  if(!insumoId||!cantidad||isNaN(cantidad)){toast('Elige un insumo y una cantidad válida');return;}
  if(insumoTieneVariantes(ins)&&!varianteId){toast('Elige la variante del insumo');return;}
  const target=getBuilderArray(kind); target.push({insumoId,varianteId:varianteId||null,cantidad});
  document.getElementById(kind+'-cant').value=''; refreshChips(kind); updatePreview();
}
function refreshChips(kind){
  const target = getBuilderArray(kind);
  const el = document.getElementById(kind+'-chips');
  if(el) el.innerHTML = chipsHTML(kind, target);
}
function removeRecetaItem(kind, idx){
  const target = getBuilderArray(kind);
  target.splice(idx,1);
  refreshChips(kind);
  updatePreview();
}
function updatePreview(){
  const mpManual = parseFloat(document.getElementById('pf-manual')?.value)||0;
  const empManual = parseFloat(document.getElementById('pf-emp-manual')?.value)||0;
  const herr = parseFloat(document.getElementById('pf-herr')?.value)||0;
  const mano = parseFloat(document.getElementById('pf-mano')?.value)||0;
  const mp = recetaMPBuilder.length ? costoDeReceta(recetaMPBuilder) : mpManual;
  const emp = recetaEmpBuilder.length ? costoDeReceta(recetaEmpBuilder) : empManual;
  const sub = mp+herr+emp+mano;
  const box = document.getElementById('preview-box');
  if(!box) return;
  box.innerHTML = `
    <div class="cost-row"><span>Materia prima</span><span>${fmt(mp)}</span></div>
    <div class="cost-row"><span>Desgaste herramientas</span><span>${fmt(herr)}</span></div>
    <div class="cost-row"><span>Empaque</span><span>${fmt(emp)}</span></div>
    <div class="cost-row"><span>Mano de obra</span><span>${fmt(mano)}</span></div>
    <div class="cost-row total"><span>Subtotal (costo real)</span><span>${fmt(sub)}</span></div>
    <div class="divider" style="margin:8px 0"></div>
    <div class="cost-row"><span>Precio sugerido · 50% ganancia</span><span>${fmt(sub*1.5)}</span></div>
    <div class="cost-row"><span>Precio sugerido · 100% ganancia</span><span>${fmt(sub*2)}</span></div>
    <div class="cost-row"><span>Precio sugerido · 200% ganancia</span><span>${fmt(sub*3)}</span></div>
  `;
}
function saveProducto(){
  const nombre = document.getElementById('pf-nombre').value.trim();
  if(!nombre){ toast('Ponle un nombre al producto'); return; }
  const wholesale = document.getElementById('pf-mayor').checked;
  const variantesValidas = variantesBuilder.filter(v=>v.nombre.trim());
  const data = {
    nombre,
    receta: recetaMPBuilder,
    recetaEmpaque: recetaEmpBuilder,
    variantes: variantesValidas,
    materiaPrimaManual: parseFloat(document.getElementById('pf-manual').value)||0,
    empaqueManual: parseFloat(document.getElementById('pf-emp-manual').value)||0,
    desgasteHerramientas: parseFloat(document.getElementById('pf-herr').value)||0,
    manoObra: parseFloat(document.getElementById('pf-mano').value)||0,
    precioFinal: parseFloat(document.getElementById('pf-precio').value)||0,
    wholesale,
    tiers: wholesale ? [
      {unidades: parseFloat(document.getElementById('pf-t1u').value)||0, pct: parseFloat(document.getElementById('pf-t1p').value)||0},
      {unidades: parseFloat(document.getElementById('pf-t2u').value)||0, pct: parseFloat(document.getElementById('pf-t2p').value)||0},
    ] : []
  };
  const editId = document.getElementById('producto-form').dataset.editId;
  if(editId){
    const idx = state.productos.findIndex(p=>p.id===editId);
    confirmarAntesDe('Vas a guardar estos cambios en el producto:', [
      ['Nombre', nombre],
      ['Precio de venta', fmt(data.precioFinal)],
      ['Mano de obra', fmt(data.manoObra)],
      ['Variantes', variantesValidas.length ? variantesValidas.map(v=>v.nombre).join(', ') : 'Ninguna'],
      ['Al por mayor', wholesale ? 'Sí' : 'No'],
    ], ()=>{
      const precioAnterior = state.productos[idx].precioFinal;
      state.productos[idx] = {...state.productos[idx], ...data};
      logPrecio('producto', editId, nombre, precioAnterior, data.precioFinal, 'Editado manualmente');
      logActividad('producto','editar', `Producto editado: ${nombre}`);
      guardarProducto(state.productos[idx]); toast('Producto guardado'); closeProductoForm(); render();
    });
  } else {
    const mp = recetaMPBuilder.length ? costoDeReceta(recetaMPBuilder) : data.materiaPrimaManual;
    const emp = recetaEmpBuilder.length ? costoDeReceta(recetaEmpBuilder) : data.empaqueManual;
    const sub = mp + data.desgasteHerramientas + emp + data.manoObra;
    confirmarAntesDe('Vas a agregar este producto nuevo:', [
      ['Nombre', nombre],
      ['Costo estimado', fmt(sub)],
      ['Precio de venta', fmt(data.precioFinal)],
      ['Ganancia estándar', fmt(data.precioFinal - sub)],
      ['Variantes', variantesValidas.length ? variantesValidas.map(v=>v.nombre).join(', ') : 'Ninguna'],
      ['Al por mayor', wholesale ? 'Sí' : 'No'],
    ], ()=>{
      const nuevo = { stock: 0, ...data };
      guardarProducto(nuevo); // le asigna nuevo.id (id real de Firestore)
      state.productos.push(nuevo);
      logPrecio('producto', nuevo.id, nombre, null, data.precioFinal, 'Precio inicial');
      logActividad('producto','agregar', `Producto agregado: ${nombre}`);
      toast('Producto agregado'); closeProductoForm(); render();
    });
  }
}
function editProducto(id){
  const p = state.productos.find(x=>x.id===id);
  openProductoForm(p);
  document.getElementById('producto-form').scrollIntoView({behavior:'smooth'});
}
function fabricarPrompt(productoId, varianteId){
  const p = state.productos.find(x=>x.id===productoId); if(!p) return;
  const variante = varianteId ? p.variantes.find(v=>v.id===varianteId) : null;
  showFormModal({
    titulo: `Fabricar "${p.nombre}${variante?' — '+variante.nombre:''}"`,
    fields: [{ id:'fm-fabricar-cant', label:'¿Cuántas unidades vas a fabricar?', type:'number', min:1, helptext:'Se descontarán los insumos de la receta según esta cantidad.' }],
    confirmLabel: 'Fabricar',
    onConfirm: (vals)=>{
      const cantidad = parseFloat(vals['fm-fabricar-cant']);
      if(!cantidad || cantidad<=0){ toast('Pon una cantidad válida'); return; }
      const res = fabricar(productoId, varianteId, cantidad); // fabricar() ya persiste solo (increment atómico)
      logActividad('fabricacion','registrar', `Fabricadas ${cantidad} u. de ${p.nombre}${variante?' — '+variante.nombre:''}`);
      if(res.faltantes.length) toast(`Se fabricaron ${cantidad} u. — ⚠️ insumo insuficiente: ${res.faltantes.join(', ')} (quedó en negativo)`);
      else toast(`Se fabricaron ${cantidad} unidades — insumos descontados`);
      render();
    }
  });
}
function closeProductoForm(){ document.getElementById('producto-form').innerHTML=''; }
function deleteProducto(id){
  const p = state.productos.find(x=>x.id===id); if(!p) return;
  confirmarAntesDe('¿Eliminar este producto?', [
    ['Nombre', p.nombre],
    ['Advertencia', 'Esta acción no se puede deshacer.'],
  ], ()=>{
    state.productos = state.productos.filter(x=>x.id!==id);
    eliminarProductoDoc(id);
    logActividad('producto','eliminar', `Producto eliminado: ${p.nombre}`);
    render();
  }, 'Sí, eliminar');
}
