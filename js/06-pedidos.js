/* ============================================================
   PESTANA: PEDIDOS
   Pedidos hace las veces de "ventas": aparta stock al crearse,
   y reparte cada abono con prioridad inversion -> mano de obra -> ganancia.
   (registrarAbono al final es solo para ventas antiguas heredadas)
   ============================================================ */

let pedidoEstadoFilter = 'pendiente';

let pedidoItemsBuilder = [];
function pedidoProductosTotal(p){
  return p.items.reduce((s,it)=> s + (it.precioUnitario||0)*it.cantidad, 0);
}
function pedidoTotal(p){
  return pedidoProductosTotal(p) + ((p.domicilio && p.domicilio.activo) ? (p.domicilio.valor||0) : 0);
}
function costosPedidoItem(it){
  const p = state.productos.find(x=>x.id===it.productoId);
  if(!p) return {inversion:0, manoObra:0};
  const variante = it.varianteId ? p.variantes.find(v=>v.id===it.varianteId) : null;
  const mp = materiaPrimaTotal(p, variante), herr = p.desgasteHerramientas||0, emp = empaqueCosto(p);
  return { inversion: (mp+herr+emp)*it.cantidad, manoObra: (p.manoObra||0)*it.cantidad };
}
/* Costo de mano de obra tradicional (la de armar los productos) y de domicilio, por separado */
function costoManoObraTradicionalPedido(p){ return p.costoManoObraBase||0; }
function costoManoObraDomicilioPedido(p){ return (p.domicilio && p.domicilio.activo) ? (p.domicilio.valor||0) : 0; }
function costoManoObraPedido(p){ return costoManoObraTradicionalPedido(p) + costoManoObraDomicilioPedido(p); }

/* Reparte el abono con prioridad: 1º recupera inversión (materiales), 2º mano de obra
   (tradicional + domicilio juntas, repartidas entre ellas proporcional a lo que pesa cada
   una en ESTE pedido), 3º lo que sobra es ganancia. */
function distribuirAbono(costoInversion, costoManoObraTrad, costoManoObraDom, abonoTotal){
  let restante = abonoTotal;
  const inv = Math.min(restante, costoInversion); restante -= inv;
  const costoManoObraTotal = costoManoObraTrad + costoManoObraDom;
  const moPool = Math.min(restante, costoManoObraTotal); restante -= moPool;
  let moTrad = 0, moDom = 0;
  if(costoManoObraTotal > 0){
    moTrad = +(moPool * (costoManoObraTrad / costoManoObraTotal)).toFixed(2);
    moDom = +(moPool - moTrad).toFixed(2); // así no se pierde nada por redondeo
  }
  const gan = Math.max(0, restante);
  return { inv, moTrad, moDom, gan };
}
/* Aplica un nuevo total de abono al pedido, ajustando las bolsas globales solo por la diferencia (delta) */
function aplicarAbonoPedido(p, nuevoAbonoTotal){
  const total = pedidoTotal(p);
  nuevoAbonoTotal = Math.max(0, Math.min(nuevoAbonoTotal, total));
  const nueva = distribuirAbono(p.costoInversion||0, costoManoObraTradicionalPedido(p), costoManoObraDomicilioPedido(p), nuevoAbonoTotal);
  const previa = p.aplicado || {inv:0, moTrad:0, moDom:0, gan:0};
  const dInv = nueva.inv - previa.inv, dTrad = nueva.moTrad - previa.moTrad, dDom = nueva.moDom - previa.moDom, dGan = nueva.gan - previa.gan;
  state.totales.inversion += dInv; // optimista en local
  state.totales.manoObraTradicional += dTrad;
  state.totales.manoObraDomicilio += dDom;
  state.totales.ganancia += dGan;
  ajustarTotales({ inversion: dInv, manoObraTradicional: dTrad, manoObraDomicilio: dDom, ganancia: dGan }); // atómico en Firestore
  p.aplicado = nueva;
  p.abono = nuevoAbonoTotal;
  p.saldoPendiente = +(total - nuevoAbonoTotal).toFixed(2);
}
function renderPedidos(){
  const filtered = pedidoEstadoFilter==='todos' ? state.pedidos.slice() : state.pedidos.filter(p=>p.estado===pedidoEstadoFilter);
  filtered.sort((a,b)=> new Date(a.fechaEntrega) - new Date(b.fechaEntrega));

  const cards = filtered.map(p=>{
    const dias = diasHasta(p.fechaEntrega);
    const estadoPill = p.estado==='pendiente'
      ? `<span class="status-pill ${urgenciaClase(dias)}">${urgenciaTxt(dias)}</span>`
      : p.estado==='entregado' ? `<span class="status-pill status-ok">Entregado</span>`
      : `<span class="status-pill status-out">Cancelado</span>`;
    const saldo = p.saldoPendiente || 0;
    const menuOpen = rowMenuOpen === p.id;
    const acciones = [`<button onclick="editPedido('${p.id}')">Editar</button>`];
    if(p.estado==='pendiente'){
      if(saldo>0){
        acciones.push(`<button disabled title="Debe ${fmt(saldo)} para poder entregarse" style="opacity:.45;cursor:not-allowed">Marcar entregado (debe ${fmt(saldo)})</button>`);
      } else {
        acciones.push(`<button onclick="closeRowMenu(); confirmarCambiarEstadoPedido('${p.id}','entregado')">Marcar entregado</button>`);
      }
      acciones.push(`<button onclick="closeRowMenu(); confirmarCambiarEstadoPedido('${p.id}','cancelado')">Cancelar pedido</button>`);
    }
    acciones.push(`<button class="danger" onclick="closeRowMenu(); confirmarDeletePedido('${p.id}')">Eliminar</button>`);
    return `
    <div class="pedido-card">
      <div class="pedido-card-head">
        <div>
          <div class="pedido-cliente">${p.cliente}</div>
          ${p.telefono?`<div class="caption">${p.telefono}</div>`:''}
        </div>
        <div class="row-menu">
          <button class="btn btn-ghost btn-sm row-menu-btn" onclick="toggleRowMenu('${p.id}')" aria-label="Más acciones">⋮</button>
          ${menuOpen?`<div class="row-menu-dropdown">${acciones.join('')}</div>`:''}
        </div>
      </div>
      <div class="pedido-productos">${p.items.map(nombreProductoPedidoItem).join(', ')}${(p.domicilio&&p.domicilio.activo)?` <span class="muted">+ Domicilio ${fmt(p.domicilio.valor)}</span>`:''}</div>
      ${p.notas?`<div class="caption" style="margin-top:2px">📝 ${p.notas}</div>`:''}
      <div class="pedido-card-row">
        <span class="caption">Entrega: <b style="color:var(--ink)">${p.fechaEntrega}</b></span>
        ${estadoPill}
      </div>
      <div class="divider" style="margin:10px 0"></div>
      <div class="pedido-money-grid">
        <div><div class="pedido-money-label">Total</div><div class="pedido-money-val">${fmt(pedidoTotal(p))}</div></div>
        <div><div class="pedido-money-label">Abonado</div><div class="pedido-money-val">${fmt(p.abono||0)}</div></div>
        <div><div class="pedido-money-label">Saldo</div><div class="pedido-money-val" style="color:${saldo>0?'var(--red)':'inherit'}">${fmt(saldo)}</div></div>
      </div>
      ${saldo>0 && p.estado!=='cancelado' ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%" onclick="registrarAbonoPedido('${p.id}')">+ Abono</button>` : ''}
    </div>`;
  }).join('');

  const chip = (v,label) => `<button class="filter-chip ${pedidoEstadoFilter===v?'active':''}" onclick="setPedidoFiltro('${v}')">${label}</button>`;

  return `
    <div class="card">
      <div class="section-head">
        <div><h2>Pedidos</h2><div class="sub">Al guardar, se aparta el producto de tu inventario (fabricando solo lo que falte) y el abono se reparte primero a recuperar materiales, luego mano de obra, y lo que sobra es ganancia.</div></div>
        <button class="btn btn-primary" onclick="toggleAddPedido()">+ Nuevo pedido</button>
      </div>
      <div id="pedido-form"></div>
      <div class="divider"></div>
      <div class="search-row">
        ${chip('todos','Todos')}
        ${chip('pendiente','Pendientes')}
        ${chip('entregado','Entregados')}
        ${chip('cancelado','Cancelados')}
      </div>
    </div>
    ${filtered.length===0?`<div class="card"><div class="empty">No hay pedidos en este filtro.</div></div>`: `<div class="pedido-list">${cards}</div>`}
  `;
}
function toggleRowMenu(id){ rowMenuOpen = rowMenuOpen===id ? null : id; render(); }
function closeRowMenu(){ rowMenuOpen = null; }
function confirmarCambiarEstadoPedido(id, estado){
  const p = state.pedidos.find(x=>x.id===id); if(!p) return;
  if(estado==='entregado' && (p.saldoPendiente||0) > 0){
    toast(`Este pedido todavía debe ${fmt(p.saldoPendiente)} — no se puede marcar como entregado hasta que quede pagado por completo.`);
    return;
  }
  const filas = [['Cliente', p.cliente], ['Nuevo estado', estado==='entregado'?'Entregado':'Cancelado']];
  if(estado==='cancelado') filas.push(['Importante', 'El stock de producto ya fabricado se devuelve al inventario. Los insumos no, porque ya se transformaron.']);
  confirmarAntesDe(estado==='entregado' ? '¿Marcar este pedido como entregado?' : '¿Cancelar este pedido?', filas, ()=>{
    cambiarEstadoPedido(id, estado);
  }, estado==='cancelado' ? 'Sí, cancelar' : 'Sí, marcar entregado');
}
function confirmarDeletePedido(id){
  const p = state.pedidos.find(x=>x.id===id); if(!p) return;
  confirmarAntesDe('¿Eliminar este pedido?', [
    ['Cliente', p.cliente],
    ['Productos', p.items.map(nombreProductoPedidoItem).join(', ')],
    ['Advertencia', p.estado==='pendiente' ? 'No devuelve stock automáticamente. Si quieres recuperarlo, mejor cancela en vez de eliminar.' : 'Esta acción no se puede deshacer.'],
  ], ()=>{ deletePedido(id); }, 'Sí, eliminar');
}
function setPedidoFiltro(v){ pedidoEstadoFilter=v; render(); }
function toggleAddPedido(){
  const el = document.getElementById('pedido-form');
  if(el.innerHTML && !el.dataset.editId){ el.innerHTML=''; return; }
  openPedidoForm();
}
function pedidoProductoOptionsHTML(){
  return state.productos.map(p=>`<option value="${p.id}">${p.nombre} — ${fmt(p.precioFinal)}</option>`).join('') || `<option value="" disabled selected>Primero crea un producto</option>`;
}
function openPedidoForm(existing){
  pedidoItemsBuilder = existing ? JSON.parse(JSON.stringify(existing.items)) : [];
  const p = existing || { cliente:'', telefono:'', fechaEntrega: today(), notas:'', estado:'pendiente', domicilio:{activo:false, valor:0} };
  const dom = p.domicilio || {activo:false, valor:0};
  const el = document.getElementById('pedido-form');
  el.dataset.editId = existing ? existing.id : '';
  el.innerHTML = `
    <div class="divider"></div>
    <div class="grid3">
      <div class="field"><label>Cliente</label><input id="pd-cliente" type="text" placeholder="Nombre del cliente" value="${p.cliente}"></div>
      <div class="field"><label>Teléfono (opcional)</label><input id="pd-tel" type="text" value="${p.telefono||''}"></div>
      <div class="field"><label>Fecha de entrega</label><input id="pd-fecha" type="date" value="${p.fechaEntrega}"></div>
    </div>
    <div class="recipe-block">
      <label>Productos del pedido</label>
      ${existing ? `<div class="helptext" style="margin-bottom:8px">Los productos ya se apartaron/fabricaron cuando se creó este pedido, por eso no se pueden cambiar aquí. Si necesitas otros productos, cancela este pedido (devuelve el stock) y crea uno nuevo.</div>
      <div id="pd-chips">${pedidoChipsHTML()}</div>` : `
      <div id="pd-chips">${pedidoChipsHTML()}</div>
      <div class="grid3" style="align-items:end">
        <div class="field" style="margin-bottom:0"><label>Producto</label><select id="pd-producto" onchange="onPedidoProductoChange()">${pedidoProductoOptionsHTML()}</select></div>
        <div id="pd-variante-wrap" class="field" style="margin-bottom:0"></div>
        <div class="field" style="margin-bottom:0"><label>Cantidad</label><input id="pd-cant" type="number" min="1" value="1"></div>
      </div>
      <div class="field" style="max-width:260px">
        <label>Precio para este pedido (opcional)</label>
        <input id="pd-precio-override" type="number" min="0" placeholder="Por defecto">
        <div class="helptext" id="pd-precio-helptext">Déjalo vacío para usar el precio de lista. Ponle un valor solo si vas a dar descuento en este pedido.</div>
      </div>
      <button class="btn btn-ghost" style="margin-top:8px" onclick="addPedidoItem()">+ Agregar producto al pedido</button>
      <div class="helptext">Al guardar: se descuenta el stock de esa cantidad. Si ya tenías suficiente fabricado, no se tocan los insumos; si falta, se fabrica solo la diferencia.</div>
      `}
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="pd-domicilio-check" ${dom.activo?'checked':''} style="width:auto" onchange="document.getElementById('pd-domicilio-valor-wrap').style.display=this.checked?'':'none'">
      <label style="margin:0">¿Lleva domicilio?</label>
    </div>
    <div id="pd-domicilio-valor-wrap" class="field" style="max-width:220px;${dom.activo?'':'display:none'}">
      <label>Valor del domicilio</label>
      <input id="pd-domicilio-valor" type="number" min="0" value="${dom.valor||0}">
      <div class="helptext">Se suma al total del pedido y cuenta como costo de mano de obra.</div>
    </div>
    ${existing ? '' : `
    <div class="field" style="max-width:220px"><label>Abono recibido ahora (opcional)</label><input id="pd-abono" type="number" min="0" value="0"></div>
    <div class="helptext">Ese abono se reparte así: primero recupera lo gastado en materiales, luego lo de mano de obra, y lo que sobre queda como ganancia.</div>
    `}
    <div class="field"><label>Notas (opcional)</label><input id="pd-notas" type="text" placeholder="Ej. entregar en la tarde, dedicatoria, etc." value="${p.notas||''}"></div>
    <button class="btn btn-primary" style="margin-top:10px" onclick="savePedido()">${existing?'Guardar cambios':'Guardar pedido y apartar stock'}</button>
    <button class="btn btn-ghost" style="margin-top:10px" onclick="closePedidoForm()">Cancelar</button>
  `;
  if(!existing) onPedidoProductoChange();
}
function onPedidoProductoChange(){
  const pid = document.getElementById('pd-producto')?.value;
  const prod = state.productos.find(x=>x.id===pid);
  const wrap = document.getElementById('pd-variante-wrap');
  if(!wrap) return;
  if(prod && prod.variantes && prod.variantes.length){
    wrap.innerHTML = `<label>Variante</label><select id="pd-variante"><option value="">(sin variante)</option>${prod.variantes.map(v=>`<option value="${v.id}">${v.nombre}</option>`).join('')}</select>`;
  } else {
    wrap.innerHTML = '';
  }
  const precioInput = document.getElementById('pd-precio-override');
  if(precioInput && prod){
    precioInput.placeholder = `Por defecto: ${fmt(prod.precioFinal)}`;
    precioInput.value = '';
  }
}
function pedidoChipsHTML(){
  if(pedidoItemsBuilder.length===0) return `<div class="helptext" style="margin:6px 0">Sin productos agregados aún.</div>`;
  const editando = !!document.getElementById('pedido-form')?.dataset.editId;
  return pedidoItemsBuilder.map((it,idx)=>{
    const prod = state.productos.find(x=>x.id===it.productoId);
    const esDescuento = prod && it.precioUnitario < prod.precioFinal;
    return `<span class="chip">${it.cantidad} × ${nombreProductoPedidoItem(it)} — ${fmt(it.precioUnitario)}${esDescuento?' <b style="color:var(--red)">(desc.)</b>':''}${editando ? '' : ` <button onclick="removePedidoItem(${idx})">✕</button>`}</span>`;
  }).join('');
}
function addPedidoItem(){
  const productoId = document.getElementById('pd-producto').value;
  const varianteSel = document.getElementById('pd-variante');
  const varianteId = varianteSel ? (varianteSel.value || null) : null;
  const cantidad = parseFloat(document.getElementById('pd-cant').value) || 0;
  if(!productoId || !cantidad){ toast('Elige un producto y una cantidad válida'); return; }
  const prod = state.productos.find(x=>x.id===productoId);
  const precioOverrideRaw = document.getElementById('pd-precio-override').value;
  const precioOverride = precioOverrideRaw!=='' ? parseFloat(precioOverrideRaw) : null;
  const precioUnitario = (precioOverride!==null && !isNaN(precioOverride)) ? precioOverride : (prod ? prod.precioFinal : 0);
  pedidoItemsBuilder.push({productoId, varianteId, cantidad, precioUnitario});
  document.getElementById('pd-chips').innerHTML = pedidoChipsHTML();
  document.getElementById('pd-precio-override').value = '';
}
function removePedidoItem(idx){
  pedidoItemsBuilder.splice(idx,1);
  document.getElementById('pd-chips').innerHTML = pedidoChipsHTML();
}
function closePedidoForm(){ const el=document.getElementById('pedido-form'); el.innerHTML=''; el.dataset.editId=''; }
function savePedido(){
  const cliente = document.getElementById('pd-cliente').value.trim();
  const telefono = document.getElementById('pd-tel').value.trim();
  const fechaEntrega = document.getElementById('pd-fecha').value;
  const notas = document.getElementById('pd-notas').value.trim();
  const domicilioActivo = document.getElementById('pd-domicilio-check').checked;
  const domicilioValor = domicilioActivo ? (parseFloat(document.getElementById('pd-domicilio-valor').value)||0) : 0;
  if(!cliente){ toast('Ponle un nombre al cliente'); return; }
  if(!fechaEntrega){ toast('Elige una fecha de entrega'); return; }
  const editId = document.getElementById('pedido-form').dataset.editId;
  if(editId){
    const p = state.pedidos.find(x=>x.id===editId);
    if(!p) return;
    confirmarAntesDe('Vas a guardar estos cambios en el pedido:', [
      ['Cliente', cliente],
      ['Teléfono', telefono||'—'],
      ['Fecha de entrega', fechaEntrega],
      ['Domicilio', domicilioActivo?fmt(domicilioValor):'No'],
      ['Notas', notas||'—'],
    ], ()=>{
      p.cliente=cliente; p.telefono=telefono; p.fechaEntrega=fechaEntrega; p.notas=notas;
      p.domicilio = {activo: domicilioActivo, valor: domicilioValor};
      aplicarAbonoPedido(p, p.abono||0); // recalcula el reparto con el nuevo costo de mano de obra (domicilio pudo cambiar)
      logActividad('pedido','editar', `Pedido editado: ${cliente}`);
      guardarPedido(p); toast('Pedido actualizado'); closePedidoForm(); render();
    });
  } else {
    if(pedidoItemsBuilder.length===0){ toast('Agrega al menos un producto al pedido'); return; }
    const abonoInicial = parseFloat(document.getElementById('pd-abono').value)||0;
    const totalPreview = pedidoItemsBuilder.reduce((s,it)=>s+it.precioUnitario*it.cantidad,0) + (domicilioActivo?domicilioValor:0);
    confirmarAntesDe('Vas a crear este pedido (aparta el stock ya mismo):', [
      ['Cliente', cliente],
      ['Productos', pedidoItemsBuilder.map(it=>`${it.cantidad}× ${nombreProductoPedidoItem(it)}`).join(', ')],
      ['Fecha de entrega', fechaEntrega],
      ['Domicilio', domicilioActivo?fmt(domicilioValor):'No'],
      ['Total del pedido', fmt(totalPreview)],
      ['Abono inicial', fmt(abonoInicial)],
    ], ()=>{
      let avisos = [];
      let fabricoAlgo = false;
      let costoInversion = 0, costoManoObraBase = 0;
      pedidoItemsBuilder.forEach(it=>{
        const c = costosPedidoItem(it);
        costoInversion += c.inversion; costoManoObraBase += c.manoObra;
        const p = state.productos.find(x=>x.id===it.productoId);
        if(!p) return;
        const variante = it.varianteId ? p.variantes.find(v=>v.id===it.varianteId) : null;
        const disponible = stockProducto(p, variante);
        const faltante = +(it.cantidad - disponible).toFixed(4);
        if(faltante > 0){
          fabricoAlgo = true;
          const res = fabricar(it.productoId, it.varianteId, faltante);
          if(res.faltantes && res.faltantes.length) avisos.push(...res.faltantes);
        }
        // se aparta el pedido completo del stock disponible (recién fabricado o ya existente)
        if(variante){
          variante.stock = +(((variante.stock||0)) - it.cantidad).toFixed(4);
          ajustarStockVarianteProducto(p.id, variante.id, -it.cantidad);
        } else {
          p.stock = +(((p.stock||0)) - it.cantidad).toFixed(4);
          ajustarStockProducto(p.id, -it.cantidad);
        }
      });
      const nuevoPedido = {
        cliente, telefono, fechaEntrega, notas, estado:'pendiente',
        items: pedidoItemsBuilder, domicilio:{activo:domicilioActivo, valor:domicilioValor},
        costoInversion, costoManoObraBase, abono:0, aplicado:{inv:0,moTrad:0,moDom:0,gan:0}, saldoPendiente:0,
        creado: today()
      };
      aplicarAbonoPedido(nuevoPedido, abonoInicial); // reparte el abono inicial y ajusta totales (atómico)
      guardarPedido(nuevoPedido); // le asigna nuevoPedido.id (id real de Firestore) y persiste el documento completo
      state.pedidos.push(nuevoPedido);
      logActividad('pedido','agregar', `Pedido creado: ${cliente} — ${pedidoItemsBuilder.map(it=>`${it.cantidad}× ${nombreProductoPedidoItem(it)}`).join(', ')}`);
      closePedidoForm(); render();
      toast(avisos.length ? `Pedido guardado — ⚠️ insumo insuficiente: ${[...new Set(avisos)].join(', ')} (quedó en negativo)` : (fabricoAlgo ? 'Pedido guardado — se fabricó lo que faltaba y se apartó el stock' : 'Pedido guardado — se apartó del stock que ya tenías'));
    });
  }
}
function editPedido(id){
  const p = state.pedidos.find(x=>x.id===id); if(!p) return;
  openPedidoForm(p);
  document.getElementById('pedido-form').scrollIntoView({behavior:'smooth'});
}
function registrarAbonoPedido(id){
  const p = state.pedidos.find(x=>x.id===id); if(!p) return;
  const saldo = p.saldoPendiente || 0;
  if(saldo<=0){ toast('Este pedido ya está pagado por completo'); return; }
  showFormModal({
    titulo: `Abono de ${p.cliente} — saldo pendiente ${fmt(saldo)}`,
    fields: [{ id:'fm-abono-pedido', label:'¿Cuánto abonaron ahora?', type:'number', min:0, placeholder: saldo }],
    confirmLabel: 'Registrar abono',
    onConfirm: (vals)=>{
      const monto = parseFloat(vals['fm-abono-pedido']);
      if(!monto || monto<=0){ toast('Pon un monto válido'); return; }
      aplicarAbonoPedido(p, (p.abono||0) + monto); // ajusta totales de forma atómica por su cuenta
      guardarPedido(p); // persiste el abono/saldo actualizado del pedido
      logActividad('pedido','abonar', `Abono a pedido de ${p.cliente}: ${fmt(monto)}`);
      toast(p.saldoPendiente<=0 ? 'Pedido pagado por completo' : `Abono registrado — faltan ${fmt(p.saldoPendiente)}`);
      render();
    }
  });
}
function cambiarEstadoPedido(id, estado){
  const p = state.pedidos.find(x=>x.id===id); if(!p) return;
  if(estado==='entregado' && (p.saldoPendiente||0) > 0){
    toast(`Este pedido todavía debe ${fmt(p.saldoPendiente)} — no se puede marcar como entregado hasta que quede pagado por completo.`);
    return;
  }
  if(estado==='cancelado' && p.estado==='pendiente'){
    // Devuelve el stock de producto ya apartado (no los insumos, esos ya se transformaron)
    p.items.forEach(it=>{
      const prod = state.productos.find(x=>x.id===it.productoId);
      if(!prod) return;
      const variante = it.varianteId ? prod.variantes.find(v=>v.id===it.varianteId) : null;
      if(variante){
        variante.stock = +(((variante.stock||0)) + it.cantidad).toFixed(4);
        ajustarStockVarianteProducto(prod.id, variante.id, it.cantidad);
      } else {
        prod.stock = +(((prod.stock||0)) + it.cantidad).toFixed(4);
        ajustarStockProducto(prod.id, it.cantidad);
      }
    });
    logActividad('pedido','cancelar', `Pedido cancelado: ${p.cliente}`);
    toast('Pedido cancelado — el stock de producto ya fabricado se devolvió al inventario (los insumos no, porque ya se transformaron)');
  } else {
    p.fechaEntregado = today(); // se usa en Análisis para saber cuándo se cerró la venta de verdad
    logActividad('pedido','entregar', `Pedido entregado: ${p.cliente}`);
    toast(estado==='entregado'?'Pedido marcado como entregado':'Pedido cancelado');
  }
  p.estado = estado;
  guardarPedido(p);
  render();
}
function deletePedido(id){
  const p = state.pedidos.find(x=>x.id===id);
  state.pedidos = state.pedidos.filter(x=>x.id!==id);
  if(p){ eliminarPedidoDoc(id); logActividad('pedido','eliminar', `Pedido eliminado: ${p.cliente}`); }
  render();
}

/* Se conserva solo por si hay ventas antiguas guardadas de antes de unificar todo en Pedidos.
   Ya no se crean ventas nuevas — todo entra por Pedidos ahora. */
function registrarAbono(ventaId){
  const v = state.ventas.find(x=>x.id===ventaId); if(!v) return;
  const saldo = v.saldoPendiente || 0;
  if(saldo<=0){ toast('Esta venta ya está pagada por completo'); return; }
  const p = state.productos.find(x=>x.id===v.productoId);
  showFormModal({
    titulo: `Abono de venta — ${p?p.nombre:'producto'} — saldo pendiente ${fmt(saldo)}`,
    fields: [{ id:'fm-abono-venta', label:'¿Cuánto abonaron ahora?', type:'number', min:0, placeholder: saldo }],
    confirmLabel: 'Registrar abono',
    onConfirm: (vals)=>{
      const monto = parseFloat(vals['fm-abono-venta']);
      if(!monto || monto<=0){ toast('Pon un monto válido'); return; }
      const abonoReal = Math.min(monto, saldo);
      v.abono = +((v.abono||0) + abonoReal).toFixed(2);
      v.saldoPendiente = +(v.saldoPendiente - abonoReal).toFixed(2);
      logActividad('venta','abonar', `Abono a venta de ${p?p.nombre:'producto'}: ${fmt(abonoReal)}`);
      saveState();
      toast(v.saldoPendiente<=0 ? 'Venta saldada por completo' : `Abono registrado — faltan ${fmt(v.saldoPendiente)}`);
      render();
    }
  });
}
