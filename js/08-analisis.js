/* ============================================================
   PESTANA: ANALISIS DE VENTAS
   ============================================================ */

let analisisRango = '30d';
function fechaDentroDeRango(fechaStr){
  if(analisisRango==='todo' || !fechaStr) return true;
  const dias = analisisRango==='7d' ? 7 : 30;
  const dt = new Date(fechaStr+'T00:00:00');
  const limite = new Date(today()+'T00:00:00'); limite.setDate(limite.getDate()-dias);
  return dt >= limite;
}
function ventasFiltradas(){ return state.ventas.filter(v=>fechaDentroDeRango(v.fecha)); }
function pedidosFiltrados(){ return state.pedidos.filter(p=>p.estado!=='cancelado' && fechaDentroDeRango(p.creado)); }

function claveProducto(productoId, varianteId){ return productoId+'::'+(varianteId||''); }
function nombreClaveProducto(productoId, varianteId){
  const p = state.productos.find(x=>x.id===productoId);
  if(!p) return '(producto eliminado)';
  const v = varianteId ? p.variantes.find(x=>x.id===varianteId) : null;
  return p.nombre + (v?` — ${v.nombre}`:'');
}

/* Popularidad: combina ventas registradas + pedidos (no cancelados) para saber qué se pide/vende más */
function rankingPopularidad(){
  const map = {};
  ventasFiltradas().forEach(v=>{
    const k = claveProducto(v.productoId, v.varianteId);
    if(!map[k]) map[k] = { productoId:v.productoId, varianteId:v.varianteId, unidades:0, ingresos:0 };
    map[k].unidades += v.cantidad; map[k].ingresos += v.total;
  });
  pedidosFiltrados().forEach(p=>{
    p.items.forEach(it=>{
      const k = claveProducto(it.productoId, it.varianteId);
      if(!map[k]) map[k] = { productoId:it.productoId, varianteId:it.varianteId, unidades:0, ingresos:0 };
      map[k].unidades += it.cantidad; map[k].ingresos += (it.precioUnitario||0)*it.cantidad;
    });
  });
  return Object.values(map).sort((a,b)=>b.unidades-a.unidades);
}

/* Rentabilidad: solo de ventas registradas, porque ahí sabemos la ganancia real por unidad */
function rankingRentabilidad(){
  const map = {};
  ventasFiltradas().forEach(v=>{
    const k = claveProducto(v.productoId, v.varianteId);
    if(!map[k]) map[k] = { productoId:v.productoId, varianteId:v.varianteId, unidades:0, ingresos:0, ganancia:0 };
    map[k].unidades += v.cantidad; map[k].ingresos += v.total; map[k].ganancia += v.ganancia;
  });
  return Object.values(map).map(r=>({...r, margen: r.ingresos>0 ? (r.ganancia/r.ingresos*100) : 0})).sort((a,b)=>b.ganancia-a.ganancia);
}



function barsHTML(rows, valueKey, labelFn, fmtFn, goldTop3){
  if(rows.length===0) return `<div class="empty">Sin datos suficientes en este rango todavía.</div>`;
  const max = Math.max(...rows.map(r=>r[valueKey]), 1);
  return rows.map((r,idx)=>`
    <div class="rank-row">
      <div class="rank-row-head"><span class="rname">${idx+1}. ${labelFn(r)}</span><span class="rval">${fmtFn(r)}</span></div>
      <div class="rank-bar-bg"><div class="rank-bar-fill ${goldTop3&&idx<3?'gold':''}" style="width:${Math.max(3,r[valueKey]/max*100)}%"></div></div>
    </div>
  `).join('');
}

function generarInsights(popularidad, rentabilidad){
  const insights = [];
  if(popularidad.length===0){
    insights.push({txt:'Todavía no hay ventas ni pedidos en este rango de fechas para analizar. Prueba con "Todo" o registra algunas ventas primero.', warn:false});
    return insights;
  }
  const estrella = popularidad[0];
  insights.push({txt:`<b>${nombreClaveProducto(estrella.productoId, estrella.varianteId)}</b> es lo que más se mueve: ${estrella.unidades} unidades por ${fmt(estrella.ingresos)} en este período.`, warn:false});

  if(rentabilidad.length>1){
    const porMargen = rentabilidad.slice().sort((a,b)=>b.margen-a.margen);
    const mejorMargen = porMargen[0];
    const unidadesProm = rentabilidad.reduce((s,r)=>s+r.unidades,0)/rentabilidad.length;
    if(mejorMargen.unidades < unidadesProm && mejorMargen.margen>0){
      insights.push({txt:`<b>${nombreClaveProducto(mejorMargen.productoId, mejorMargen.varianteId)}</b> tiene el mejor margen (${mejorMargen.margen.toFixed(0)}%) pero se vende por debajo del promedio (${mejorMargen.unidades} u.). Vale la pena empujarlo más — en redes o cuando alguien pregunte por algo similar.`, warn:false});
    }
    const margenPromedioGlobal = rentabilidad.reduce((s,r)=>s+r.ganancia,0) / (rentabilidad.reduce((s,r)=>s+r.ingresos,0)||1) * 100;
    const topVolumen = rentabilidad.slice().sort((a,b)=>b.unidades-a.unidades)[0];
    if(topVolumen.margen < margenPromedioGlobal - 8){
      insights.push({txt:`Ojo con <b>${nombreClaveProducto(topVolumen.productoId, topVolumen.varianteId)}</b>: es de los que más se vende, pero su margen (${topVolumen.margen.toFixed(0)}%) está por debajo del promedio del negocio (${margenPromedioGlobal.toFixed(0)}%). Revisa si el precio o los descuentos que le das lo justifican.`, warn:true});
    }
  }
  const sinMovimiento = state.productos.filter(p=>!popularidad.find(r=>r.productoId===p.id));
  if(sinMovimiento.length>0 && sinMovimiento.length<state.productos.length){
    insights.push({txt:`${sinMovimiento.length} producto${sinMovimiento.length===1?'':'s'} sin ninguna venta ni pedido en este período: ${sinMovimiento.slice(0,4).map(p=>p.nombre).join(', ')}${sinMovimiento.length>4?'…':''}. Revisa si vale la pena destacarlos o si conviene descontinuarlos.`, warn:false});
  }
  const cobrar = totalPorCobrar();
  if(cobrar>0) insights.push({txt:`Tienes <b>${fmt(cobrar)}</b> por cobrar entre pedidos y ventas con abono parcial — revisa la pestaña Resumen para ver a quién.`, warn:true});
  const criticos = insumosCriticosOrdenados();
  if(criticos.length>0) insights.push({txt:`${criticos.length} insumo${criticos.length===1?'':'s'} bajo${criticos.length===1?'':'s'} de stock, y varios están en tus productos más vendidos — no dejes que te frenen una venta. Revisa Insumos.`, warn:true});
  return insights;
}

function renderAnalisis(){
  const popularidad = rankingPopularidad();
  const rentabilidad = rankingRentabilidad();
  const ventasR = ventasFiltradas();
  const pedidosR = pedidosFiltrados();

  const totalIngresosVentas = ventasR.reduce((s,v)=>s+v.total,0);
  const totalUnidadesVentas = ventasR.reduce((s,v)=>s+v.cantidad,0);
  const totalGananciaVentas = ventasR.reduce((s,v)=>s+v.ganancia,0);
  const ticketProm = ventasR.length ? totalIngresosVentas/ventasR.length : 0;
  const margenProm = totalIngresosVentas>0 ? (totalGananciaVentas/totalIngresosVentas*100) : 0;
  const valorPedidos = pedidosR.reduce((s,p)=>s+pedidoTotal(p),0);

  const rangoChip = (v,label) => `<button class="filter-chip date-chip ${analisisRango===v?'active':''}" onclick="setAnalisisRango('${v}')">${label}</button>`;
  const insights = generarInsights(popularidad, rentabilidad);

  return `
    <div class="card">
      <div class="section-head"><div><h2>Análisis de ventas</h2><div class="sub">Qué se vende más, qué deja más plata, y qué vale la pena ajustar — como un analista de datos, pero con tus propios números.</div></div></div>
      <div class="search-row">
        ${rangoChip('7d','Últimos 7 días')}
        ${rangoChip('30d','Últimos 30 días')}
        ${rangoChip('todo','Todo')}
      </div>
    </div>

    <div class="apart-grid">
      <div class="apart apart-inv"><div class="label">Ingresos por ventas</div><div class="amount">${fmt(totalIngresosVentas)}</div></div>
      <div class="apart apart-labor"><div class="label">Unidades vendidas</div><div class="amount">${totalUnidadesVentas}</div></div>
      <div class="apart apart-profit"><div class="label">Ticket promedio</div><div class="amount">${fmt(ticketProm)}</div></div>
      <div class="apart apart-cobrar" style="background:var(--lilac-deep)"><div class="label">Margen promedio</div><div class="amount">${margenProm.toFixed(0)}%</div></div>
    </div>
    ${valorPedidos>0?`<div class="helptext" style="margin:-10px 0 16px">+ ${fmt(valorPedidos)} en pedidos de este período (no incluidos arriba, esos se cuentan cuando entran como venta).</div>`:''}

    <div class="card">
      <div class="section-head"><div><h2>Recomendaciones</h2></div></div>
      ${insights.map(i=>`<div class="insight-card ${i.warn?'warn':''}">${i.txt}</div>`).join('')}
    </div>

    <div class="card">
      <h2>Lo que más se pide (unidades)</h2>
      <div class="sub">Ventas registradas + pedidos, así sepas qué preparar seguido.</div>
      ${barsHTML(popularidad.slice(0,8), 'unidades', r=>nombreClaveProducto(r.productoId,r.varianteId), r=>`${r.unidades} u. · ${fmt(r.ingresos)}`, true)}
    </div>

    <div class="card">
      <h2>Lo que más ganancia deja</h2>
      <div class="sub">Solo ventas ya registradas (donde se conoce la ganancia real). No siempre es lo mismo que "lo más vendido".</div>
      ${barsHTML(rentabilidad.slice(0,8), 'ganancia', r=>nombreClaveProducto(r.productoId,r.varianteId), r=>`${fmt(r.ganancia)} · margen ${r.margen.toFixed(0)}%`, true)}
    </div>
  `;
}
function setAnalisisRango(v){ analisisRango = v; render(); }
