/* ============================================================
   PESTANA: ANALISIS DE VENTAS
   Las "ventas" que se analizan aquí son los PEDIDOS ya entregados (por eso, además, un pedido
   solo se puede marcar como entregado cuando ya está pagado por completo — así estos números
   siempre reflejan plata que ya entró de verdad, no promesas).
   ============================================================ */

let analisisRango = 'semana'; // 'dia' | 'semana' | 'mes' | 'todo'
function fechaDentroDeRango(fechaStr){
  if(analisisRango==='todo') return true;
  if(!fechaStr) return true;
  if(analisisRango==='dia') return fechaStr===today();
  const dias = analisisRango==='semana' ? 7 : 30;
  const dt = new Date(fechaStr+'T00:00:00');
  const limite = new Date(today()+'T00:00:00'); limite.setDate(limite.getDate()-dias);
  return dt >= limite;
}
function ventasFiltradas(){ return state.ventas.filter(v=>fechaDentroDeRango(v.fecha)); } // ventas heredadas, de antes de unificar todo en Pedidos
function pedidosFiltrados(){ return state.pedidos.filter(p=>p.estado!=='cancelado' && fechaDentroDeRango(p.creado)); } // para "qué se pide", sin importar si ya se entregó
function pedidosEntregadosFiltrados(){ return state.pedidos.filter(p=>p.estado==='entregado' && fechaDentroDeRango(p.fechaEntregado||p.creado)); } // para "qué ya se vendió de verdad"

function claveProducto(productoId, varianteId){ return productoId+'::'+(varianteId||''); }
function nombreClaveProducto(productoId, varianteId){
  const p = state.productos.find(x=>x.id===productoId);
  if(!p) return '(producto eliminado)';
  const v = varianteId ? p.variantes.find(x=>x.id===varianteId) : null;
  return p.nombre + (v?` — ${v.nombre}`:'');
}

/* Popularidad: combina ventas heredadas + TODOS los pedidos no cancelados (entregados o no),
   para saber qué se pide/vende más — esto es sobre demanda, no importa si ya se cobró todo. */
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

/* Rentabilidad: ventas heredadas (ganancia ya conocida por unidad) + pedidos YA ENTREGADOS
   (por eso ya pagados al 100%, así que su ganancia final es exacta, no una promesa a medias).
   Cuando un pedido trae varios productos mezclados, la ganancia de ese pedido se reparte entre
   sus productos proporcional a lo que vale cada uno dentro del pedido. */
function rankingRentabilidad(){
  const map = {};
  ventasFiltradas().forEach(v=>{
    const k = claveProducto(v.productoId, v.varianteId);
    if(!map[k]) map[k] = { productoId:v.productoId, varianteId:v.varianteId, unidades:0, ingresos:0, ganancia:0 };
    map[k].unidades += v.cantidad; map[k].ingresos += v.total; map[k].ganancia += v.ganancia;
  });
  pedidosEntregadosFiltrados().forEach(p=>{
    const gananciaPedido = (p.aplicado && p.aplicado.gan) || 0;
    const totalProductos = pedidoProductosTotal(p);
    p.items.forEach(it=>{
      const k = claveProducto(it.productoId, it.varianteId);
      if(!map[k]) map[k] = { productoId:it.productoId, varianteId:it.varianteId, unidades:0, ingresos:0, ganancia:0 };
      const ingresoItem = (it.precioUnitario||0)*it.cantidad;
      const gananciaItem = totalProductos>0 ? gananciaPedido * (ingresoItem/totalProductos) : 0;
      map[k].unidades += it.cantidad;
      map[k].ingresos += ingresoItem;
      map[k].ganancia += gananciaItem;
    });
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
    insights.push({txt:'Todavía no hay pedidos en este rango de fechas para analizar. Prueba con "Todo".', warn:false});
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
    insights.push({txt:`${sinMovimiento.length} producto${sinMovimiento.length===1?'':'s'} sin ningún pedido en este período: ${sinMovimiento.slice(0,4).map(p=>p.nombre).join(', ')}${sinMovimiento.length>4?'…':''}. Revisa si vale la pena destacarlos o si conviene descontinuarlos.`, warn:false});
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
  const entregadosR = pedidosEntregadosFiltrados();
  const pendientesR = state.pedidos.filter(p=>p.estado==='pendiente' && fechaDentroDeRango(p.creado));

  // Estos 4 números son los "montos fijos": solo se mueven cuando de verdad entra o sale una
  // venta (pedido entregado), NUNCA por un gasto o ingreso manual de Balance.
  const totalIngresos = entregadosR.reduce((s,p)=>s+pedidoTotal(p),0) + ventasR.reduce((s,v)=>s+v.total,0);
  const totalUnidades = entregadosR.reduce((s,p)=>s+p.items.reduce((s2,it)=>s2+it.cantidad,0),0) + ventasR.reduce((s,v)=>s+v.cantidad,0);
  const totalGanancia = entregadosR.reduce((s,p)=>s+((p.aplicado&&p.aplicado.gan)||0),0) + ventasR.reduce((s,v)=>s+v.ganancia,0);
  const numTransacciones = entregadosR.length + ventasR.length;
  const ticketProm = numTransacciones ? totalIngresos/numTransacciones : 0;
  const margenProm = totalIngresos>0 ? (totalGanancia/totalIngresos*100) : 0;
  const valorPendientes = pendientesR.reduce((s,p)=>s+pedidoTotal(p),0);

  const rangoChip = (v,label) => `<button class="filter-chip date-chip ${analisisRango===v?'active':''}" onclick="setAnalisisRango('${v}')">${label}</button>`;
  const insights = generarInsights(popularidad, rentabilidad);

  return `
    <div class="card">
      <div class="section-head"><div><h2>Análisis de ventas</h2><div class="sub">Qué se vende más, qué deja más plata, y qué vale la pena ajustar — como un analista de datos, pero con tus propios números. Cuenta solo pedidos ya <b>entregados y pagados</b>, así que estos montos no se mueven por gastos ni préstamos de Balance.</div></div></div>
      <div class="search-row">
        ${rangoChip('dia','Hoy')}
        ${rangoChip('semana','Esta semana')}
        ${rangoChip('mes','Este mes')}
        ${rangoChip('todo','Todo')}
      </div>
    </div>

    <div class="apart-grid">
      <div class="apart apart-inv"><div class="label">Ventas (ingresos)</div><div class="amount">${fmt(totalIngresos)}</div></div>
      <div class="apart apart-labor"><div class="label">Unidades vendidas</div><div class="amount">${totalUnidades}</div></div>
      <div class="apart apart-profit"><div class="label">Ganancia total</div><div class="amount">${fmt(totalGanancia)}</div></div>
      <div class="apart apart-cobrar" style="background:var(--lilac-deep)"><div class="label">Margen promedio</div><div class="amount">${margenProm.toFixed(0)}%</div></div>
    </div>
    <div class="helptext" style="margin:-10px 0 16px">Ticket promedio: ${fmt(ticketProm)} (${numTransacciones} venta${numTransacciones===1?'':'s'} cerrada${numTransacciones===1?'':'s'}).${valorPendientes>0?` + ${fmt(valorPendientes)} en pedidos pendientes de entregar (no cuentan aquí todavía).`:''}</div>

    <div class="card">
      <div class="section-head"><div><h2>Recomendaciones</h2></div></div>
      ${insights.map(i=>`<div class="insight-card ${i.warn?'warn':''}">${i.txt}</div>`).join('')}
    </div>

    <div class="card">
      <h2>Lo que más se pide (unidades)</h2>
      <div class="sub">Todos los pedidos activos (entregados o no), así sepas qué preparar seguido.</div>
      ${barsHTML(popularidad.slice(0,8), 'unidades', r=>nombreClaveProducto(r.productoId,r.varianteId), r=>`${r.unidades} u. · ${fmt(r.ingresos)}`, true)}
    </div>

    <div class="card">
      <h2>Lo que más ganancia deja</h2>
      <div class="sub">Solo pedidos ya entregados y pagados por completo (ahí la ganancia ya es exacta). No siempre es lo mismo que "lo más vendido".</div>
      ${barsHTML(rentabilidad.slice(0,8), 'ganancia', r=>nombreClaveProducto(r.productoId,r.varianteId), r=>`${fmt(r.ganancia)} · margen ${r.margen.toFixed(0)}%`, true)}
    </div>
  `;
}
function setAnalisisRango(v){ analisisRango = v; render(); }
