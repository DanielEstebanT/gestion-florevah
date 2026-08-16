/* ============================================================
   PESTANA: HISTORIAL DE PRECIOS
   ============================================================ */

let historialTipo = 'producto'; // 'producto' | 'insumo'
let historialItemId = null; // null = vista general
let historialPage = 1;

function sparklineSVG(points){
  const width=640, height=150, padY=16;
  if(points.length===0) return `<div class="empty">Sin datos suficientes todavía.</div>`;
  if(points.length===1){
    return `<svg viewBox="0 0 ${width} ${height}" class="spark-svg"><circle cx="${width/2}" cy="${height/2}" r="5" fill="#9B5FA8"/></svg>`;
  }
  const ys = points.map(p=>p.y);
  const maxY = Math.max(...ys), minY = Math.min(...ys);
  const rangeY = (maxY-minY)||1;
  const stepX = width/(points.length-1);
  const coordsArr = points.map((p,i)=>{
    const x = i*stepX;
    const y = padY + (height-2*padY) - ((p.y-minY)/rangeY)*(height-2*padY);
    return {x,y};
  });
  const coords = coordsArr.map(c=>`${c.x},${c.y}`).join(' ');
  const areaPath = `M${coordsArr[0].x},${height} L` + coordsArr.map(c=>`${c.x},${c.y}`).join(' L') + ` L${coordsArr[coordsArr.length-1].x},${height} Z`;
  const dots = coordsArr.map((c,i)=>`<circle cx="${c.x}" cy="${c.y}" r="4" fill="#9B5FA8"><title>${points[i].label}: ${fmt(points[i].y)}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" class="spark-svg" preserveAspectRatio="none">
    <path d="${areaPath}" fill="#E8C6EA" opacity="0.45"/>
    <polyline points="${coords}" fill="none" stroke="#9B5FA8" stroke-width="2.5" stroke-linejoin="round"/>
    ${dots}
  </svg>`;
}

function historialDeItem(tipo, refId){
  return state.historialPrecios.filter(h=>h.tipo===tipo && h.refId===refId).sort((a,b)=> a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}
function variacionPct(historial){
  if(historial.length<2) return null;
  const primero = historial[0].precioNuevo, ultimo = historial[historial.length-1].precioNuevo;
  if(!primero) return null;
  return ((ultimo-primero)/primero*100);
}

/* Costo de una receta sustituyendo el precio de UN insumo puntual (para simular "¿cuánto costaba antes?") */
function costoRecetaConPrecioCustom(receta, insumoId, precioCustom){
  return (receta||[]).reduce((s,r)=>{
    const ins = state.insumos.find(i=>i.id===r.insumoId);
    if(!ins) return s;
    const precio = (r.insumoId===insumoId && precioCustom!=null) ? precioCustom : ins.precioUnidad;
    return s + precio * r.cantidad;
  }, 0);
}
function costoProductoConInsumoPrecio(p, variante, insumoId, precioCustom){
  const mp = p.receta.length ? costoRecetaConPrecioCustom(p.receta, insumoId, precioCustom) : (p.materiaPrimaManual||0);
  const emp = p.recetaEmpaque.length ? costoRecetaConPrecioCustom(p.recetaEmpaque, insumoId, precioCustom) : (p.empaqueManual||0);
  const varExtra = variante ? costoRecetaConPrecioCustom(variante.receta, insumoId, precioCustom) : 0;
  return mp + emp + varExtra + (p.desgasteHerramientas||0) + (p.manoObra||0);
}
/* ¿Qué productos usan este insumo, y cómo les afectó su último cambio de precio de compra?
   Responde justo la pregunta: "subió el proveedor, ¿bajó el margen o ya subiste el precio de venta?" */
function impactoInsumoEnProductos(insumoId){
  const hist = historialDeItem('insumo', insumoId);
  const cambiosReales = hist.filter(h=>h.precioAnterior!==null);
  if(cambiosReales.length===0) return { hayDatos:false, filas:[] };
  const ultimoCambio = cambiosReales[cambiosReales.length-1];

  const usaInsumo = (receta) => (receta||[]).some(r=>r.insumoId===insumoId);
  const filas = [];
  state.productos.forEach(p=>{
    const variantesQueUsan = (p.variantes||[]).filter(v=>usaInsumo(v.receta));
    const productoBaseUsa = usaInsumo(p.receta) || usaInsumo(p.recetaEmpaque);
    const combos = [];
    if(productoBaseUsa) combos.push(null);
    combos.push(...variantesQueUsan);
    if(!productoBaseUsa && variantesQueUsan.length===0) return;

    combos.forEach(variante=>{
      const costoActual = costoProductoConInsumoPrecio(p, variante, insumoId, null); // precio actual real
      const costoAntes = costoProductoConInsumoPrecio(p, variante, insumoId, ultimoCambio.precioAnterior);
      const costoExtra = costoActual - costoAntes;
      const margenActual = p.precioFinal - costoActual;
      const margenActualPct = p.precioFinal>0 ? (margenActual/p.precioFinal*100) : 0;

      const cambiosPrecioProducto = historialDeItem('producto', p.id).filter(h=> h.fecha >= ultimoCambio.fecha && h.precioAnterior!==null);
      const subioPrecio = cambiosPrecioProducto.reduce((s,h)=> s + (h.precioNuevo-h.precioAnterior), 0);
      const cubierto = subioPrecio >= costoExtra - 0.01;

      filas.push({
        nombre: p.nombre + (variante?` — ${variante.nombre}`:''),
        costoExtra, margenActual, margenActualPct,
        ajusto: cambiosPrecioProducto.length>0, subioPrecio, cubierto
      });
    });
  });
  return { hayDatos:true, ultimoCambio, filas: filas.sort((a,b)=>b.costoExtra-a.costoExtra) };
}

function impactoInsumoHTML(insumo){
  const { hayDatos, ultimoCambio, filas } = impactoInsumoEnProductos(insumo.id);
  if(!hayDatos){
    return `<div class="card"><h2>Impacto en tus productos</h2><div class="empty">Aún no hay un cambio de precio real (solo el precio inicial) para calcular el impacto.</div></div>`;
  }
  if(filas.length===0){
    return `<div class="card"><h2>Impacto en tus productos</h2><div class="empty">Ningún producto usa este insumo en su receta todavía.</div></div>`;
  }
  const delta = ultimoCambio.precioNuevo - ultimoCambio.precioAnterior;
  const filasHTML = filas.map(f=>`
    <div class="insight-card ${f.cubierto?'':'warn'}">
      <b>${f.nombre}</b> — este cambio le sube el costo en <b>${fmt(f.costoExtra)}</b> por unidad.
      Margen actual: <b style="color:${f.margenActualPct<0?'var(--red)':'inherit'}">${fmt(f.margenActual)} (${f.margenActualPct.toFixed(0)}%)</b>.
      ${f.ajusto
        ? (f.cubierto
            ? ` ✅ Ya subiste el precio de venta (+${fmt(f.subioPrecio)} desde entonces) — alcanza a cubrir el aumento.`
            : ` ⚠️ Subiste el precio de venta +${fmt(f.subioPrecio)}, pero no alcanza a cubrir todo el aumento de costo.`)
        : ` ⚠️ No has ajustado el precio de venta desde ese cambio — ese margen extra te lo estás comiendo.`}
    </div>
  `).join('');
  return `
    <div class="card">
      <div class="section-head"><div><h2>Impacto en tus productos</h2><div class="sub">Por el último cambio de precio (${ultimoCambio.fecha}): ${delta>0?'subió':'bajó'} de ${fmt(ultimoCambio.precioAnterior)} a ${fmt(ultimoCambio.precioNuevo)}.</div></div></div>
      ${filasHTML}
    </div>
  `;
}

function renderHistorial(){
  const items = historialTipo==='producto' ? state.productos : state.insumos;
  const nombreCampo = historialTipo==='producto' ? 'precioFinal' : 'precioUnidad';

  // Resumen de variación por ítem (para el ranking cuando no hay uno seleccionado)
  const resumenItems = items.map(it=>{
    const hist = historialDeItem(historialTipo, it.id);
    const pct = variacionPct(hist);
    return { id: it.id, nombre: it.nombre, precioActual: it[nombreCampo], cambios: hist.length, pct };
  }).filter(r=>r.pct!==null).sort((a,b)=> Math.abs(b.pct)-Math.abs(a.pct));

  const tipoChip = (v,label) => `<button class="filter-chip ${historialTipo===v?'active':''}" onclick="setHistorialTipo('${v}')">${label}</button>`;
  const itemOptions = items.map(it=>`<option value="${it.id}" ${historialItemId===it.id?'selected':''}>${it.nombre}</option>`).join('');

  let detalleHTML = '';
  if(historialItemId){
    const item = items.find(x=>x.id===historialItemId);
    if(item){
      const hist = historialDeItem(historialTipo, item.id);
      const puntos = hist.map(h=>({ x:h.fecha, y:h.precioNuevo, label:h.fecha }));
      const pct = variacionPct(hist);
      const histOrdenado = hist.slice().reverse();
      const { items: histPage, page, totalPages } = paginar(histOrdenado, historialPage);
      historialPage = page;
      const filas = histPage.map(h=>{
        const delta = h.precioAnterior!==null ? h.precioNuevo-h.precioAnterior : null;
        return `<tr>
          <td>${h.fecha}</td>
          <td class="num">${h.precioAnterior!==null?fmt(h.precioAnterior):'—'}</td>
          <td class="num">${fmt(h.precioNuevo)}</td>
          <td class="num" style="color:${delta>0?'var(--red)':delta<0?'var(--lilac-deep)':'inherit'};font-weight:700">${delta===null?'—':(delta>0?'+':'')+fmt(delta)}</td>
          <td>${h.detalle||''}</td>
        </tr>`;
      }).join('');
      detalleHTML = `
      <div class="card">
        <div class="section-head">
          <div><h2>${item.nombre}</h2><div class="sub">${hist.length} cambio${hist.length===1?'':'s'} registrado${hist.length===1?'':'s'}${pct!==null?` · variación total: <b style="color:${pct>0?'var(--red)':'var(--lilac-deep)'}">${pct>0?'+':''}${pct.toFixed(1)}%</b>`:''}</div></div>
        </div>
        ${sparklineSVG(puntos)}
      </div>
      <div class="card">
        <h2>Movimientos de precio</h2>
        <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th class="num">Precio anterior</th><th class="num">Precio nuevo</th><th class="num">Cambio</th><th>Detalle</th></tr></thead>
          <tbody>${filas || `<tr><td colspan="5" class="muted">Sin movimientos aún.</td></tr>`}</tbody>
        </table>
        </div>
        ${paginacionHTML(page, totalPages, 'setHistorialPage')}
      </div>
      ${historialTipo==='insumo' ? impactoInsumoHTML(item) : ''}`;
    }
  } else {
    const subida = resumenItems.filter(r=>r.pct>0).slice(0,5);
    const bajada = resumenItems.filter(r=>r.pct<0).slice(0,5);
    detalleHTML = `
      <div class="card">
        <h2>${historialTipo==='producto'?'Productos':'Insumos'} que más subieron de precio</h2>
        <div class="sub">${historialTipo==='insumo'?'Útil para saber qué proveedores están subiendo costos.':'Precio de venta al público.'}</div>
        ${subida.length===0?`<div class="empty">Sin subidas registradas todavía.</div>`:barsHTML(subida.map(r=>({...r, abs: Math.abs(r.pct)})), 'abs', r=>r.nombre, r=>`${fmt(r.precioActual)} · +${r.pct.toFixed(1)}%`, true)}
      </div>
      <div class="card">
        <h2>${historialTipo==='producto'?'Productos':'Insumos'} que más bajaron de precio</h2>
        ${bajada.length===0?`<div class="empty">Sin bajadas registradas todavía.</div>`:barsHTML(bajada.map(r=>({...r, abs: Math.abs(r.pct)})), 'abs', r=>r.nombre, r=>`${fmt(r.precioActual)} · ${r.pct.toFixed(1)}%`, false)}
      </div>
      ${resumenItems.length===0?`<div class="card"><div class="empty">Todavía no hay suficiente historial. Se va llenando cada vez que editas el precio de un producto o registras una compra de insumo.</div></div>`:''}
    `;
  }

  return `
    <div class="card">
      <div class="section-head"><div><h2>Historial de precios</h2><div class="sub">Sube o baja el precio de venta de tus productos, y el costo de compra de tus insumos por proveedor — para saber en qué fijarte.</div></div></div>
      <div class="search-row">
        ${tipoChip('producto','Productos')}
        ${tipoChip('insumo','Insumos')}
      </div>
      <div class="field" style="margin-top:10px;max-width:320px">
        <label>Ver un ítem específico (opcional)</label>
        <select onchange="setHistorialItem(this.value)">
          <option value="">— Vista general —</option>
          ${itemOptions}
        </select>
      </div>
    </div>
    ${detalleHTML}
  `;
}
function setHistorialTipo(v){ historialTipo=v; historialItemId=null; historialPage=1; render(); }
function setHistorialItem(v){ historialItemId = v || null; historialPage=1; render(); }
function setHistorialPage(p){ historialPage = p; render(); window.scrollTo(0,0); }
