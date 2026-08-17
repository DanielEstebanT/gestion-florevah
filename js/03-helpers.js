/* ============================================================
   HELPERS DE NEGOCIO COMPARTIDOS
   Calculo de costos, stock, fechas de urgencia y "por cobrar".
   Los usan varias pestanas (Inicio, Pedidos, Analisis, Resumen),
   por eso viven aparte y no dentro de un solo modulo de pestana.
   ============================================================ */

function costoDeReceta(receta){
  return receta.reduce((sum,r)=>{
    const ins = state.insumos.find(i=>i.id===r.insumoId);
    return sum + (ins ? ins.precioUnidad*r.cantidad : 0);
  },0);
}
function materiaPrima(p){ return p.receta.length ? costoDeReceta(p.receta) : (p.materiaPrimaManual||0); }
function materiaPrimaTotal(p, variante){ return materiaPrima(p) + (variante ? costoDeReceta(variante.receta) : 0); }
function empaqueCosto(p){ return p.recetaEmpaque.length ? costoDeReceta(p.recetaEmpaque) : (p.empaqueManual||0); }
function subtotal(p){ return materiaPrima(p) + (p.desgasteHerramientas||0) + empaqueCosto(p) + (p.manoObra||0); }
function subtotalConVariante(p, variante){ return subtotal(p) + (variante ? costoDeReceta(variante.receta) : 0); }
function stockStatus(i){
  if(i.stockActual<=0) return 'out';
  if(i.stockActual<=i.stockMinimo) return 'low';
  return 'ok';
}
function stockProducto(p, variante){ return (variante ? variante.stock : p.stock) || 0; }
/* Fabricar = descuenta insumos según receta y suma al inventario de productos terminados.
   Sigue siendo síncrona (edita `state` al instante, igual que siempre) — por debajo, cada
   descuento de insumo y cada suma de stock de producto se manda a Firestore como un
   increment() atómico, así que si los dos fabrican lo mismo al tiempo, ninguno se pierde. */
function fabricar(productoId, varianteId, cantidad){
  const p = state.productos.find(x=>x.id===productoId);
  if(!p || !cantidad || cantidad<=0) return {ok:false, faltantes:[]};
  const variante = varianteId ? p.variantes.find(v=>v.id===varianteId) : null;
  const receta = [...p.receta, ...p.recetaEmpaque, ...(variante?variante.receta:[])];
  const faltantes = receta.filter(r=>{
    const ins = state.insumos.find(i=>i.id===r.insumoId);
    return ins && ins.stockActual < r.cantidad*cantidad;
  }).map(r=>state.insumos.find(i=>i.id===r.insumoId).nombre);
  receta.forEach(r=>{
    const ins = state.insumos.find(i=>i.id===r.insumoId);
    if(ins){
      const delta = -(r.cantidad*cantidad);
      ins.stockActual = +(ins.stockActual + delta).toFixed(4);
      ajustarStockInsumo(ins.id, delta);
    }
  });
  if(variante){
    variante.stock = +(((variante.stock||0)) + cantidad).toFixed(4);
    ajustarStockVarianteProducto(p.id, variante.id, cantidad);
  } else {
    p.stock = +(((p.stock||0)) + cantidad).toFixed(4);
    ajustarStockProducto(p.id, cantidad);
  }
  return {ok:true, faltantes:[...new Set(faltantes)]};
}
function diasHasta(fechaStr){
  if(!fechaStr) return null;
  const hoy = new Date(today()+'T00:00:00');
  const f = new Date(fechaStr+'T00:00:00');
  return Math.round((f-hoy)/86400000);
}
function urgenciaTxt(dias){
  if(dias===null) return '';
  if(dias<0) return `Atrasado ${Math.abs(dias)} día${Math.abs(dias)===1?'':'s'}`;
  if(dias===0) return 'Entrega hoy';
  if(dias===1) return 'Entrega mañana';
  return `En ${dias} días`;
}
function urgenciaClase(dias){
  if(dias===null) return '';
  if(dias<=0) return 'status-out';
  if(dias<=3) return 'status-low';
  return 'status-ok';
}
function pedidosPendientesOrdenados(){
  return state.pedidos.filter(p=>p.estado==='pendiente').slice().sort((a,b)=> new Date(a.fechaEntrega) - new Date(b.fechaEntrega));
}
function insumosCriticosOrdenados(){
  return state.insumos.filter(i=>stockStatus(i)!=='ok').slice().sort((a,b)=>{
    const sa = stockStatus(a)==='out'?0:1, sb = stockStatus(b)==='out'?0:1;
    if(sa!==sb) return sa-sb;
    const ra = a.stockMinimo? a.stockActual/a.stockMinimo : 0, rb = b.stockMinimo? b.stockActual/b.stockMinimo : 0;
    return ra-rb;
  });
}
function totalPorCobrarVentas(){
  return state.ventas.reduce((s,v)=> s + Math.max(0, v.saldoPendiente||0), 0);
}
function totalPorCobrarPedidos(){
  return state.pedidos.filter(p=>p.estado!=='cancelado').reduce((s,p)=> s + Math.max(0, p.saldoPendiente||0), 0);
}
function totalPorCobrar(){
  return totalPorCobrarVentas() + totalPorCobrarPedidos();
}
function nombreProductoPedidoItem(it){
  const p = state.productos.find(x=>x.id===it.productoId);
  if(!p) return '(producto eliminado)';
  const v = it.varianteId ? p.variantes.find(x=>x.id===it.varianteId) : null;
  return p.nombre + (v?` (${v.nombre})`:'');
}
