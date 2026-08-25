/* ============================================================
   HELPERS DE NEGOCIO COMPARTIDOS
   Calculo de costos, stock, fechas de urgencia y "por cobrar".
   Los usan varias pestanas (Inicio, Pedidos, Analisis, Resumen),
   por eso viven aparte y no dentro de un solo modulo de pestana.
   ============================================================ */

function varianteInsumo(ins, varianteId){
  if(!ins || !varianteId || !Array.isArray(ins.variantes)) return null;
  return ins.variantes.find(v=>v.id===varianteId && v.activa!==false) || null;
}
function costoItemReceta(r){
  const ins = state.insumos.find(i=>i.id===r.insumoId);
  if(!ins) return 0;
  const v = varianteInsumo(ins, r.varianteId);
  return (v ? (v.precioUnidad||0) : (ins.precioUnidad||0)) * r.cantidad;
}
function costoDeReceta(receta){ return (receta||[]).reduce((sum,r)=>sum+costoItemReceta(r),0); }
function recetaItemNombre(r){
  const ins=state.insumos.find(i=>i.id===r.insumoId); if(!ins) return '—';
  const v=varianteInsumo(ins,r.varianteId); return v ? `${ins.nombre} — ${v.nombre}` : ins.nombre;
}
function stockDisponibleInsumo(ins,varianteId){ const v=varianteInsumo(ins,varianteId); return v ? (v.stockActual||0) : (ins?.stockActual||0); }
function materiaPrima(p){ return (p.receta||[]).length ? costoDeReceta(p.receta) : (p.materiaPrimaManual||0); }
function materiaPrimaTotal(p,variante){ return materiaPrima(p)+(variante?costoDeReceta(variante.receta):0); }
function empaqueCosto(p){ return (p.recetaEmpaque||[]).length ? costoDeReceta(p.recetaEmpaque) : (p.empaqueManual||0); }
function subtotal(p){ return materiaPrima(p)+(p.desgasteHerramientas||0)+empaqueCosto(p)+(p.manoObra||0); }
function subtotalConVariante(p,variante){ return subtotal(p)+(variante?costoDeReceta(variante.receta):0); }
function stockStatus(i){
  if(i && Array.isArray(i.variantes) && i.variantes.length){
    const vs=i.variantes.filter(v=>v.activa!==false); if(!vs.length) return 'out';
    const total=vs.reduce((s,v)=>s+(v.stockActual||0),0);
    if(total<=0) return 'out';
    if(vs.some(v=>(v.stockActual||0)<=0 || (v.stockActual||0)<=(v.stockMinimo??i.stockMinimo??0))) return 'low';
    return 'ok';
  }
  if((i?.stockActual||0)<=0) return 'out';
  if((i?.stockActual||0)<=(i?.stockMinimo||0)) return 'low';
  return 'ok';
}
function stockProducto(p,variante){ return (variante?variante.stock:p.stock)||0; }
function fabricar(productoId,varianteId,cantidad){
  const p=state.productos.find(x=>x.id===productoId); if(!p||!cantidad||cantidad<=0) return {ok:false,faltantes:[]};
  const variante=varianteId?(p.variantes||[]).find(v=>v.id===varianteId):null;
  const receta=[...(p.receta||[]),...(p.recetaEmpaque||[]),...(variante?variante.receta||[]:[])];
  const faltantes=[];
  receta.forEach(r=>{ const ins=state.insumos.find(i=>i.id===r.insumoId); if(ins&&stockDisponibleInsumo(ins,r.varianteId)<r.cantidad*cantidad) faltantes.push(recetaItemNombre(r)); });
  receta.forEach(r=>{
    const ins=state.insumos.find(i=>i.id===r.insumoId); if(!ins) return; const delta=-(r.cantidad*cantidad); const v=varianteInsumo(ins,r.varianteId);
    if(v){ v.stockActual=+((v.stockActual||0)+delta).toFixed(4); ins.stockActual=+((ins.stockActual||0)+delta).toFixed(4); ajustarStockInsumoVariante(ins.id,v.id,delta); }
    else { ins.stockActual=+((ins.stockActual||0)+delta).toFixed(4); ajustarStockInsumo(ins.id,delta); }
  });
  if(variante){ variante.stock=+((variante.stock||0)+cantidad).toFixed(4); ajustarStockVarianteProducto(p.id,variante.id,cantidad); }
  else { p.stock=+((p.stock||0)+cantidad).toFixed(4); ajustarStockProducto(p.id,cantidad); }
  return {ok:true,faltantes:[...new Set(faltantes)]};
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
