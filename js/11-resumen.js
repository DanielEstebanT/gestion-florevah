/* ============================================================
   PESTANA: RESUMEN (totales, por cobrar, respaldo/restaurar)
   ============================================================ */

let resumenRango = 'total';
/* Recalcula inversión/mano de obra/ganancia SOLO del período elegido, mirando la fecha real de cada
   venta, pedido (fecha en que se creó y se le aplicó el abono) y movimiento manual de balance. */
function totalesPeriodo(rango){
  const enRango = (fechaStr) => {
    if(rango==='total' || !fechaStr) return rango==='total';
    if(rango==='dia') return fechaStr===today();
    if(rango==='semana'){
      const dt = new Date(fechaStr+'T00:00:00');
      const limite = new Date(today()+'T00:00:00'); limite.setDate(limite.getDate()-7);
      return dt>=limite;
    }
    return true;
  };
  if(rango==='total') return { inversion: state.totales.inversion, manoObraTradicional: state.totales.manoObraTradicional||0, manoObraDomicilio: state.totales.manoObraDomicilio||0, ganancia: state.totales.ganancia };
  let inversion=0, manoObraTradicional=0, manoObraDomicilio=0, ganancia=0;
  state.ventas.forEach(v=>{ if(enRango(v.fecha)){ inversion+=v.inversion||0; manoObraTradicional+=v.manoObra||0; ganancia+=v.ganancia||0; } });
  state.pedidos.forEach(p=>{ if(p.aplicado && enRango(p.creado)){ inversion+=p.aplicado.inv||0; manoObraTradicional+=p.aplicado.moTrad||0; manoObraDomicilio+=p.aplicado.moDom||0; ganancia+=p.aplicado.gan||0; } });
  state.movimientos.forEach(m=>{
    if(!enRango(m.fecha)) return;
    const d = m.tipo==='ingreso' ? m.monto : -m.monto;
    if(m.bolsa==='inversion') inversion+=d;
    else if(m.bolsa==='manoObraTradicional') manoObraTradicional+=d;
    else if(m.bolsa==='manoObraDomicilio') manoObraDomicilio+=d;
    else ganancia+=d;
  });
  return { inversion, manoObraTradicional, manoObraDomicilio, ganancia };
}
function setResumenRango(v){ resumenRango=v; render(); }
function renderResumen(){
  const t = totalesPeriodo(resumenRango);
  const rangoLabel = resumenRango==='total' ? 'Total' : (resumenRango==='semana' ? 'Últimos 7 días' : 'Hoy');
  const bajos = state.insumos.filter(i=>stockStatus(i)!=='ok');
  const bajosRows = bajos.map(i=>`
    <tr><td>${i.nombre} <span class="origen-pill origen-${i.origen}" style="margin-left:4px">${i.origen==='local'?'Local':'Extranjero'}</span></td><td class="num">${i.stockActual} ${i.unidad}</td><td class="num">${i.stockMinimo} ${i.unidad}</td>
    <td><span class="status-pill ${stockStatus(i)==='out'?'status-out':'status-low'}">${stockStatus(i)==='out'?'Agotado':'Bajo'}</span></td></tr>
  `).join('');
  const pendientesCobroVentas = state.ventas.filter(v=>(v.saldoPendiente||0)>0);
  const pendientesCobroPedidos = state.pedidos.filter(p=>p.estado!=='cancelado' && (p.saldoPendiente||0)>0);
  const totalPorCobrarValor = totalPorCobrar();
  const cobroRowsVentas = pendientesCobroVentas.map(v=>{
    const p = state.productos.find(x=>x.id===v.productoId);
    return `<tr>
      <td>Venta</td>
      <td>${v.fecha}</td>
      <td>${p?p.nombre:'(producto eliminado)'}${v.varianteNombre?` — ${v.varianteNombre}`:''}</td>
      <td class="num">${fmt(v.total)}</td>
      <td class="num">${fmt(v.abono||0)}</td>
      <td class="num" style="color:var(--red);font-weight:700">${fmt(v.saldoPendiente)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="registrarAbono('${v.id}')">+ Abono</button></td>
    </tr>`;
  }).join('');
  const cobroRowsPedidos = pendientesCobroPedidos.map(p=>`<tr>
      <td>Pedido</td>
      <td>${p.fechaEntrega}</td>
      <td>${p.cliente}</td>
      <td class="num">${fmt(pedidoTotal(p))}</td>
      <td class="num">${fmt(p.abono||0)}</td>
      <td class="num" style="color:var(--red);font-weight:700">${fmt(p.saldoPendiente)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="registrarAbonoPedido('${p.id}')">+ Abono</button></td>
    </tr>`).join('');
  const cobroRows = cobroRowsPedidos + cobroRowsVentas;
  const hayPorCobrar = pendientesCobroVentas.length + pendientesCobroPedidos.length > 0;

  const pedidosRecientes = state.pedidos.filter(p=>p.estado!=='cancelado').slice().sort((a,b)=> b.creado.localeCompare(a.creado)).slice(0,8);
  const pedidosRecientesRows = pedidosRecientes.map(p=>{
    const ap = p.aplicado || {inv:0,moTrad:0,moDom:0,gan:0};
    return `<tr>
      <td>${p.creado}</td>
      <td>${p.cliente}<div class="caption">${p.items.map(nombreProductoPedidoItem).join(', ')}</div></td>
      <td class="num">${fmt(pedidoTotal(p))}</td>
      <td class="num">${fmt(ap.inv)}</td>
      <td class="num">${fmt(ap.moTrad)}</td>
      <td class="num">${fmt(ap.moDom)}</td>
      <td class="num" style="font-weight:700">${fmt(ap.gan)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="card" style="margin-bottom:16px">
      <div class="section-head"><div><h2>Totales del negocio</h2><div class="sub">Elige el período — el "Falta por cobrar" siempre muestra el total real, sin importar el filtro.</div></div></div>
      <div class="search-row">
        <button class="filter-chip date-chip ${resumenRango==='total'?'active':''}" onclick="setResumenRango('total')">Total</button>
        <button class="filter-chip date-chip ${resumenRango==='semana'?'active':''}" onclick="setResumenRango('semana')">Semanal (7 días)</button>
        <button class="filter-chip date-chip ${resumenRango==='dia'?'active':''}" onclick="setResumenRango('dia')">Diario (hoy)</button>
      </div>
    </div>
    <div class="apart-grid">
      <div class="apart apart-inv"><div class="label">Inversión — ${rangoLabel}</div><div class="amount">${fmt(t.inversion)}</div></div>
      <div class="apart apart-labor">
        <div class="label">Mano de obra — ${rangoLabel}</div>
        <div class="amount">${fmt((t.manoObraTradicional||0)+(t.manoObraDomicilio||0))}</div>
        <div class="apart-breakdown">Tradicional ${fmt(t.manoObraTradicional||0)} · Domicilios ${fmt(t.manoObraDomicilio||0)}</div>
      </div>
      <div class="apart apart-profit"><div class="label">Ganancia — ${rangoLabel}</div><div class="amount">${fmt(t.ganancia)}</div></div>
      <div class="apart apart-cobrar"><div class="label">Falta por cobrar</div><div class="amount">${fmt(totalPorCobrarValor)}</div></div>
    </div>
    <div class="card">
      <div class="section-head"><div><h2>Pedidos recientes</h2><div class="sub">De lo que ha entrado por cada pedido: cuánto recupera de materiales (inversión), cuánto es de mano de obra (tradicional / domicilio), y cuánto queda de ganancia — según lo abonado a la fecha.</div></div></div>
      ${pedidosRecientes.length===0?`<div class="empty">Aún no hay pedidos registrados.</div>`:`
      <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Cliente / productos</th><th class="num">Total</th><th class="num">→ Inversión</th><th class="num">→ M. obra (trad.)</th><th class="num">→ M. obra (domic.)</th><th class="num">→ Ganancia</th></tr></thead>
        <tbody>${pedidosRecientesRows}</tbody>
      </table>
      </div>`}
    </div>
    ${hayPorCobrar?`
    <div class="card">
      <div class="section-head"><div><h2>Cuentas por cobrar</h2><div class="sub">Pedidos y ventas con abono parcial — lo que aún deben.</div></div></div>
      <div class="table-wrap">
      <table>
        <thead><tr><th>Tipo</th><th>Fecha</th><th>Cliente/Producto</th><th class="num">Total</th><th class="num">Abonado</th><th class="num">Saldo</th><th></th></tr></thead>
        <tbody>${cobroRows}</tbody>
      </table>
      </div>
    </div>`:''}
    <div class="card">
      <div class="section-head"><div><h2>Insumos por reponer</h2><div class="sub">Según el umbral que definiste para cada uno.</div></div></div>
      ${bajos.length===0?`<div class="empty">Todo el inventario está en buen nivel 🌸</div>`:`
      <div class="table-wrap">
      <table>
        <thead><tr><th>Insumo</th><th class="num">Stock actual</th><th class="num">Umbral</th><th>Estado</th></tr></thead>
        <tbody>${bajosRows}</tbody>
      </table>
      </div>`}
    </div>
    <div class="card">
      <div class="section-head"><div><h2>Exportar para contabilidad</h2><div class="sub">Archivos .csv listos para abrir en Excel — para tu contador o para declarar impuestos.</div></div></div>
      <div class="backup-actions">
        <button class="btn btn-primary btn-sm" onclick="exportarPedidosCSV()">⬇ Pedidos (.csv)</button>
        <button class="btn btn-primary btn-sm" onclick="exportarMovimientosCSV()">⬇ Movimientos de balance (.csv)</button>
        ${state.ventas.length>0?`<button class="btn btn-ghost btn-sm" onclick="exportarVentasCSV()">⬇ Ventas antiguas (.csv)</button>`:''}
      </div>
    </div>
    <div class="card">
      <div class="section-head"><div><h2>Datos del negocio</h2><div class="sub">Descarga un respaldo antes de cualquier cambio grande (como migrar a Firebase) — si algo sale mal, lo puedes restaurar.</div></div>
      </div>
      <div class="cost-row"><span>Productos registrados</span><span>${state.productos.length}</span></div>
      <div class="cost-row"><span>Insumos registrados</span><span>${state.insumos.length}</span></div>
      <div class="cost-row"><span>Ventas registradas</span><span>${state.ventas.length}</span></div>
      <div class="cost-row"><span>Pedidos pendientes</span><span>${state.pedidos.filter(p=>p.estado==='pendiente').length}</span></div>
      <div class="backup-actions">
        <button class="btn btn-primary btn-sm" onclick="descargarRespaldo()">⬇ Descargar respaldo (.json)</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('restore-file-input').click()">⬆ Restaurar desde archivo</button>
        <input type="file" id="restore-file-input" accept="application/json" style="display:none" onchange="restaurarDesdeArchivo(this)">
        <button class="btn btn-ghost btn-sm" onclick="resetToSeed()">Restablecer datos de ejemplo</button>
      </div>
    </div>
  `;
}
/* Genera y descarga un CSV. Usa ; como separador y BOM UTF-8 porque Excel en español
   (Colombia) espera coma decimal, y sin el BOM las tildes/ñ salen mal. */
function descargarCSV(filename, headers, rows){
  const escape = (v) => {
    if(v===null || v===undefined) return '';
    const s = String(v);
    if(/[",;\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lineas = [headers.map(escape).join(';')];
  rows.forEach(r=> lineas.push(r.map(escape).join(';')));
  const csv = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function exportarPedidosCSV(){
  const headers = ['Fecha creación','Cliente','Teléfono','Fecha entrega','Estado','Productos','Total','Domicilio','Abonado','Saldo pendiente','Inversión','Mano de obra (tradicional)','Mano de obra (domicilio)','Ganancia','Notas'];
  const rows = state.pedidos.map(p=>{
    const ap = p.aplicado || {inv:0,moTrad:0,moDom:0,gan:0};
    return [
      p.creado, p.cliente, p.telefono||'', p.fechaEntrega,
      p.estado==='pendiente'?'Pendiente':p.estado==='entregado'?'Entregado':'Cancelado',
      p.items.map(nombreProductoPedidoItem).join(' | '),
      pedidoTotal(p), (p.domicilio&&p.domicilio.activo)?p.domicilio.valor:0,
      p.abono||0, p.saldoPendiente||0, ap.inv.toFixed(0), ap.moTrad.toFixed(0), ap.moDom.toFixed(0), ap.gan.toFixed(0), p.notas||''
    ];
  });
  descargarCSV(`florevah-pedidos-${today()}.csv`, headers, rows);
  logActividad('respaldo','registrar', 'Exportó pedidos a CSV');
  toast(`${rows.length} pedido${rows.length===1?'':'s'} exportado${rows.length===1?'':'s'}`);
}
function exportarMovimientosCSV(){
  const headers = ['Fecha','Tipo','Bolsa','Monto','Motivo'];
  const rows = state.movimientos.map(m=>[m.fecha, m.tipo==='ingreso'?'Ingreso externo':'Gasto', bolsaLabel(m.bolsa), m.monto, m.motivo||'']);
  descargarCSV(`florevah-movimientos-${today()}.csv`, headers, rows);
  logActividad('respaldo','registrar', 'Exportó movimientos a CSV');
  toast(`${rows.length} movimiento${rows.length===1?'':'s'} exportado${rows.length===1?'':'s'}`);
}
function exportarVentasCSV(){
  const headers = ['Fecha','Producto','Variante','Cantidad','Precio unitario','Total','Abonado','Saldo pendiente','Ganancia'];
  const rows = state.ventas.map(v=>{
    const p = state.productos.find(x=>x.id===v.productoId);
    return [v.fecha, p?p.nombre:'(producto eliminado)', v.varianteNombre||'', v.cantidad, v.precioUnitario, v.total, v.abono||0, v.saldoPendiente||0, v.ganancia];
  });
  descargarCSV(`florevah-ventas-${today()}.csv`, headers, rows);
  logActividad('respaldo','registrar', 'Exportó ventas antiguas a CSV');
  toast(`${rows.length} venta${rows.length===1?'':'s'} exportada${rows.length===1?'':'s'}`);
}
function descargarRespaldo(){
  const payload = { app:'florevah', version:1, exportadoEn: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fechaArchivo = today();
  a.href = url;
  a.download = `florevah-respaldo-${fechaArchivo}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  logActividad('respaldo','registrar', `Respaldo descargado (${fechaArchivo})`);
  toast('Respaldo descargado');
}
function restaurarDesdeArchivo(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    let payload;
    try{ payload = JSON.parse(e.target.result); }
    catch(err){ toast('Ese archivo no es un respaldo válido de florevah'); input.value=''; return; }
    const nuevoState = payload && payload.app==='florevah' && payload.state ? payload.state : payload;
    if(!nuevoState || !nuevoState.productos || !nuevoState.insumos){
      toast('Ese archivo no tiene el formato esperado de un respaldo de florevah'); input.value=''; return;
    }
    confirmarAntesDe('¿Restaurar este respaldo?', [
      ['Archivo', file.name],
      ['Productos en el respaldo', (nuevoState.productos||[]).length],
      ['Insumos en el respaldo', (nuevoState.insumos||[]).length],
      ['Pedidos en el respaldo', (nuevoState.pedidos||[]).length],
      ['Advertencia', 'Esto reemplaza TODOS los datos actuales por los del archivo. No se puede deshacer.'],
    ], ()=>{
      state = nuevoState;
      if(!state.movimientos) state.movimientos = [];
      if(!state.historialPrecios) state.historialPrecios = [];
      if(!state.actividad) state.actividad = [];
      toast('Restaurando respaldo…'); render();
      reemplazarTodoEnFirestore(state).then(()=>toast('Respaldo restaurado')).catch(err=>{ console.error(err); toast('Hubo un problema restaurando — revisa tu conexión'); });
    }, 'Sí, restaurar');
    input.value='';
  };
  reader.readAsText(file);
}
function resetToSeed(){
  confirmarAntesDe('¿Restablecer datos de ejemplo?', [
    ['Advertencia', 'Esto borra TODOS tus datos actuales guardados (insumos, productos, pedidos, ventas, movimientos) y los reemplaza por el ejemplo inicial.'],
  ], ()=>{
    sembrando = true;
    seed();
    toast('Restableciendo…'); render();
    reemplazarTodoEnFirestore(state)
      .then(()=>{ sembrando = false; toast('Datos de ejemplo restablecidos'); })
      .catch(err=>{ sembrando = false; console.error(err); toast('Hubo un problema restableciendo — revisa tu conexión'); });
  }, 'Sí, borrar y restablecer');
}
