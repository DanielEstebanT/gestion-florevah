/* ============================================================
   ESTADO GLOBAL Y PERSISTENCIA
   El objeto `state` es la unica fuente de verdad de los datos.
   Aqui vive todo lo que lee/guarda/sincroniza con el storage,
   mas los helpers basicos (fmt, uid, today) y los datos de ejemplo.
   Las variables de UI (tab activa, filtros de cada pestana, etc.)
   NO viven aqui -- cada modulo declara las suyas.
   ============================================================ */

let state = { insumos: [], productos: [], ventas: [], pedidos: [], movimientos: [], historialPrecios: [], actividad: [], totales: { inversion:0, manoObra:0, ganancia:0 } };

const fmt = n => (isFinite(n)?n:0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
const uid = () => Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().slice(0,10);
const ahora = () => new Date().toISOString().slice(0,16).replace('T',' ');

/* Historial de precios: registra un cambio de precio de un producto o insumo, con fecha */
function logPrecio(tipo, refId, nombre, precioAnterior, precioNuevo, detalle){
  if(precioAnterior===precioNuevo) return;
  state.historialPrecios.push({ id: uid(), tipo, refId, nombre, precioAnterior, precioNuevo, fecha: today(), detalle: detalle||'' });
}

/* Registro de actividad: guarda cada acción de crear/editar/eliminar/registrar en toda la app */
function logActividad(entidad, accion, resumen){
  state.actividad.push({ id: uid(), entidad, accion, resumen, fecha: today(), hora: ahora() });
}
function parseCantidad(str){
  if(str===undefined || str===null) return NaN;
  str = String(str).trim();
  if(!str) return NaN;
  if(str.includes('/')){
    const parts = str.split('/');
    const a = parseFloat(parts[0]), b = parseFloat(parts[1]);
    if(!b) return NaN;
    return a/b;
  }
  return parseFloat(str.replace(',','.'));
}


const STORE_KEY = 'florevah-data';
async function saveState(){
  try{ await window.storage.set(STORE_KEY, JSON.stringify(state), true); }
  catch(e){ console.error('Error guardando', e); toast('No se pudo guardar (sigue funcionando en esta sesión)'); }
}
async function loadState(silent){
  try{
    const res = await window.storage.get(STORE_KEY, true);
    if(res && res.value){ state = JSON.parse(res.value); }
    else if(!silent) { seed(); await saveState(); }
  }catch(e){ if(!silent) seed(); }
  if(!state.pedidos) state.pedidos = [];
  if(!state.movimientos) state.movimientos = [];
  if(!state.historialPrecios) state.historialPrecios = [];
  if(!state.actividad) state.actividad = [];
  loaded = true;
  render();
}
// Revisa cada 20s si tu compañero/a agregó o cambió algo, pero NUNCA si hay un formulario,
// modal, menú, o cualquier campo con algo escrito — así nunca te borra lo que estás editando,
// sin importar cuánto tiempo pases en eso.
function hayFormularioAbierto(){
  if(formDirty) return true;
  const ids = ['add-insumo-form','producto-form','pedido-form'];
  for(const id of ids){
    const el = document.getElementById(id);
    if(el && el.innerHTML.trim() !== '') return true;
  }
  if(document.getElementById('confirm-overlay')) return true;
  if(navMenuOpen || rowMenuOpen) return true;
  const escribiendo = document.activeElement && ['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName);
  if(escribiendo) return true;
  return false;
}
setInterval(()=>{
  if(!hayFormularioAbierto()) loadState(true);
}, 20000);


function seed(){
  const ins = (nombre,unidad,cantidad,precioTotal,distribuidor,umbral,origen,prioridad) => ({
    id: uid(), nombre, unidad, origen: origen||'local', prioridad: prioridad||'medio',
    stockActual: cantidad, cantidadComprada: cantidad, precioTotalComprado: precioTotal,
    precioUnidad: cantidad ? +(precioTotal/cantidad).toFixed(2) : 0,
    distribuidor: distribuidor||'', stockMinimo: umbral
  });
  const EXT = 'extranjero', LOC = 'local';
  state.insumos = [
    ins('Papel fotográfico','hojas',50,27175,'Shein',10,EXT),
    ins('Luces lámpara','unidades',20,10651,'Shein',4,EXT),
    ins('Cinta de tela roja','metros',22,5126,'Shein',5,EXT),
    ins('Cinta de tela azul','metros',22,5171,'Shein',5,EXT),
    ins('Cinta "Just for you"','metros',45.72,6312,'Shein',10,EXT),
    ins('Llaveros (base)','unidades',50,4511,'Shein',10,EXT),
    ins('Limpiapipas','unidades',100,10000,'',20,LOC,'alto'),
    ins('Ojos 8mm','unidades',70,7228,'Temu',15,EXT),
    ins('Ojos 7mm','unidades',100,7622,'Temu',20,EXT),
    ins('Nilón perlado','metros',10,18259,'Temu',2,EXT),
    ins('Papel coreano negro','hojas',40,18816,'Shein',8,EXT),
    ins('Papel coreano doble faz','hojas',20,20000,'Plaza del carnaval',4,LOC),
    ins('Silicona (barra 20cm)','unidades',100,39098,'Shein',20,EXT),
    ins('Palos verdes (30cm)','unidades',50,7961,'Shein',10,EXT),
    ins('Soportes tarjeta','unidades',80,11111,'Shein',15,EXT),
    ins('Pistilos','unidades',400,3500,'Shein',80,EXT),
    ins('Palillos','unidades',100,3000,'Por las bolas de icopor',20,LOC),
    ins('Papel aluminio','metros',16,4600,'San andresito',3,LOC),
    ins('Papel adhesivo','unidades',0,8600,'La economía',5,LOC),
    ins('Papel con figuras','unidades',1,600,'La cali',1,LOC),
    ins('Bolsas pequeñas','unidades',100,4600,'San andresito',20,LOC),
    ins('Bolsas grandes','unidades',100,7700,'San andresito',20,LOC),
    ins('Bolas de icopor #6','unidades',36,10200,'San andresito',8,LOC),
    ins('Bolas de icopor #7','unidades',24,9200,'San andresito',6,LOC),
    ins('Cinta de papel','metros',45.72,3400,'La Cali',10,LOC),
    ins('Cartón cartulina','pliegos',1,1500,'Dispapeles',1,LOC),
    ins('Acetato','pliegos',1,15000,'Papelería buendía',1,LOC),
    ins('Globos transparentes 45cm','unidades',12,7677,'Temu',3,EXT),
    ins('Globos feliz día','unidades',1,1500,'La cali',1,LOC),
    ins('Soportes de globos','unidades',1,900,'Centro',1,LOC),
    ins('Sombras (maquillaje)','unidades',0,0,'',1,LOC),
    ins('Alambre galvanizado','metros',10,6500,'Ferretería',2,LOC),
    ins('Globos largos','unidades',10,3900,'Tienda verde',2,LOC),
    ins('Cinta floral','metros',10,2900,'La economía',2,LOC),
    ins('Cinta adhesiva','metros',10,1600,'Tienda verde',2,LOC),
    ins('Oasis','unidades',1,2300,'Por el tejar',1,LOC),
    ins('Caja pequeña arreglo mediano','unidades',1,6500,'Radio sanyo',1,LOC),
    ins('Caja mediana arreglo grande','unidades',1,9000,'Radio sanyo',1,LOC),
    ins('Chocolate','gramos',1100,36700,'',200,LOC),
    ins('Polvo dorado','unidades',1,12000,'',1,LOC),
    ins('Salsa de chocolate','gramos',380,5700,'',80,LOC),
    ins('Arequipe','gramos',380,6700,'',80,LOC),
    ins('Lechera','gramos',390,5000,'',80,LOC),
    ins('Cintas de tela (surtidas)','metros',22,9000,'Pilar',5,LOC),
    ins('Vasos de cartón','unidades',20,4000,'',5,LOC),
    ins('Silicona fría','unidades',0,0,'',1,LOC),
    ins('Papel fotográfico doble cara','hojas',50,18000,'San andresito',10,LOC),
    ins('Papel adhesivo fotográfico','hojas',50,18000,'San andresito',10,LOC),
    ins('Nucita','unidades',18,11600,'Plaza carnaval',4,LOC),
    ins('Gomas anillos','unidades',100,14000,'',20,LOC),
    ins('Mini jet','unidades',24,17300,'',5,LOC),
    ins('Galleta capri','unidades',24,7200,'',5,LOC),
    ins('Vaso en cúpula','unidades',12,7000,'',3,LOC),
    ins('Cerveza Club Colombia','unidades',6,22000,'',2,LOC),
    ins('Cartulina plana pliego','pliegos',1,1500,'Economía',1,LOC),
    ins('Cartulina metalizada dorada','pliegos',1,4500,'La economía',1,LOC),
  ];
  const byName = n => state.insumos.find(i=>i.nombre===n).id;

  const prod = (nombre, receta, herramientas, empaqueManual, manoObra, precioFinal, manual, wholesale) => ({
    id: uid(), nombre, receta, recetaEmpaque: [], variantes: [], desgasteHerramientas: herramientas,
    empaqueManual: empaqueManual||0, manoObra, materiaPrimaManual: manual||0, precioFinal, stock: 0,
    wholesale: !!wholesale, tiers: wholesale ? [{unidades:12,pct:10},{unidades:24,pct:20}] : []
  });

  state.productos = [
    prod('Tulipán', [{insumoId:byName('Limpiapipas'), cantidad:15}], 100,175,3800, 9500, 0, true),
    prod('Girasol', [{insumoId:byName('Limpiapipas'), cantidad:14}], 100,175,3800, 9000, 0, true),
    prod('Gerbera', [{insumoId:byName('Limpiapipas'), cantidad:12}], 100,175,3800, 8800, 0, true),
    prod('Lirio', [{insumoId:byName('Limpiapipas'), cantidad:11}], 100,175,3800, 8400, 0, true),
    prod('Lirio de la paz', [{insumoId:byName('Limpiapipas'), cantidad:10}], 100,175,3800, 6500, 0, true),
    prod('Lavanda', [{insumoId:byName('Limpiapipas'), cantidad:2}], 100,159.22,760, 2000, 0, true),
    prod('Llavero de pulpo', [], 500,366.67,3800, 8500, 981.9, true),
    prod('Llavero de masmelo', [], 500,366.67,3800, 9000, 1381.9, true),
    prod('Colgante panda', [], 500,179.33,5320, 12000, 1958.12, true),
    prod('Tarjeta feliz día pequeña', [], 500,262.67,3800, 10500, 2405.75, true),
    prod('Miniramo', [], 500,116.67,7600, 20000, 5115.19, true),
    prod('Macetero de 3 flores', [], 500,337.03,8360, 18000, 2926.75, true),
    prod('Ramo', [], 300,116.67,15200, 38000, 10085.88, true),
    prod('Lámpara', [], 700,518.03,19000, 40000, 6406.19, true),
    prod('Caja de chocolates x4', [], 500,116.67,7600, 45000, 18618.92, false),
  ];

  state.totales = { inversion:0, manoObra:0, ganancia:0 };
  state.ventas = [];
  state.historialPrecios = [];
  state.actividad = [];
  const hace = (diasAtras) => { const dt = new Date(); dt.setDate(dt.getDate()-diasAtras); return dt.toISOString().slice(0,10); };

  // Precio inicial + actividad de creación para cada insumo y producto
  state.insumos.forEach(i=>{
    state.historialPrecios.push({ id: uid(), tipo:'insumo', refId:i.id, nombre:i.nombre, precioAnterior:null, precioNuevo:i.precioUnidad, fecha: hace(40), detalle:'Precio inicial' });
    state.actividad.push({ id: uid(), entidad:'insumo', accion:'agregar', resumen:`Insumo agregado: ${i.nombre}`, fecha: hace(40), hora: hace(40)+' 09:00' });
  });
  state.productos.forEach(p=>{
    state.historialPrecios.push({ id: uid(), tipo:'producto', refId:p.id, nombre:p.nombre, precioAnterior:null, precioNuevo:p.precioFinal, fecha: hace(40), detalle:'Precio inicial' });
    state.actividad.push({ id: uid(), entidad:'producto', accion:'agregar', resumen:`Producto agregado: ${p.nombre}`, fecha: hace(40), hora: hace(40)+' 09:05' });
  });
  // Un par de ejemplos de historial real: el papel fotográfico subió de precio con Shein, y el Ramo se reajustó
  const papelDemo = state.insumos.find(i=>i.nombre==='Papel fotográfico');
  if(papelDemo){
    const precioAntes = papelDemo.precioUnidad;
    const precioNuevoDemo = +(precioAntes*1.12).toFixed(2);
    papelDemo.precioUnidad = precioNuevoDemo;
    papelDemo.stockActual += 20; papelDemo.cantidadComprada += 20; papelDemo.precioTotalComprado += Math.round(precioNuevoDemo*20);
    state.historialPrecios.push({ id: uid(), tipo:'insumo', refId:papelDemo.id, nombre:papelDemo.nombre, precioAnterior:precioAntes, precioNuevo:precioNuevoDemo, fecha: hace(12), detalle:`Compra de 20 hojas a ${fmt(precioNuevoDemo)}/hoja — Shein` });
    state.actividad.push({ id: uid(), entidad:'compra', accion:'registrar', resumen:`Compra: 20 hojas de ${papelDemo.nombre} por ${fmt(precioNuevoDemo*20)}`, fecha: hace(12), hora: hace(12)+' 15:20' });
  }
  const ramoDemo = state.productos.find(p=>p.nombre==='Ramo');
  if(ramoDemo){
    const precioAntes = ramoDemo.precioFinal;
    const precioNuevoDemo = precioAntes + 3000;
    ramoDemo.precioFinal = precioNuevoDemo;
    state.historialPrecios.push({ id: uid(), tipo:'producto', refId:ramoDemo.id, nombre:ramoDemo.nombre, precioAnterior:precioAntes, precioNuevo:precioNuevoDemo, fecha: hace(6), detalle:'Editado manualmente' });
    state.actividad.push({ id: uid(), entidad:'producto', accion:'editar', resumen:`Producto editado: ${ramoDemo.nombre}`, fecha: hace(6), hora: hace(6)+' 11:40' });
  }

  const byNameProd = n => state.productos.find(p=>p.nombre===n)?.id;
  const d = (offsetDias) => { const dt = new Date(); dt.setDate(dt.getDate()+offsetDias); return dt.toISOString().slice(0,10); };
  const crearPedidoSeed = (cliente, telefono, fechaEntrega, notas, itemsRaw, domicilio, abonoInicial) => {
    const items = itemsRaw.map(it=>{
      const prod = state.productos.find(x=>x.id===it.productoId);
      return { ...it, precioUnitario: prod ? prod.precioFinal : 0 };
    });
    let costoInversion = 0, costoManoObraBase = 0;
    items.forEach(it=>{
      const c = costosPedidoItem(it);
      costoInversion += c.inversion; costoManoObraBase += c.manoObra;
      const prod = state.productos.find(x=>x.id===it.productoId);
      if(!prod) return;
      const variante = it.varianteId ? prod.variantes.find(v=>v.id===it.varianteId) : null;
      const disponible = stockProducto(prod, variante);
      const faltante = +(it.cantidad - disponible).toFixed(4);
      if(faltante > 0) fabricar(it.productoId, it.varianteId, faltante);
      if(variante) variante.stock = +(((variante.stock||0)) - it.cantidad).toFixed(4);
      else prod.stock = +(((prod.stock||0)) - it.cantidad).toFixed(4);
    });
    const pedido = { id: uid(), cliente, telefono, fechaEntrega, notas, estado:'pendiente', items, domicilio: domicilio||{activo:false,valor:0}, costoInversion, costoManoObraBase, abono:0, aplicado:{inv:0,mo:0,gan:0}, saldoPendiente:0, creado: today() };
    state.pedidos.push(pedido);
    aplicarAbonoPedido(pedido, abonoInicial||0);
    logActividad('pedido','agregar', `Pedido creado: ${cliente} — ${items.map(it=>`${it.cantidad}× ${nombreProductoPedidoItem(it)}`).join(', ')}`);
    return pedido;
  };
  state.pedidos = [];
  crearPedidoSeed('Camila Rosero', '320 000 0000', d(2), 'Entregar en la tarde',
    [{productoId:byNameProd('Ramo'), varianteId:null, cantidad:1}], {activo:true, valor:8000}, 20000);
  crearPedidoSeed('Pedidos aliado — Plaza del Carnaval', '', d(6), 'Al por mayor',
    [{productoId:byNameProd('Llavero de pulpo'), varianteId:null, cantidad:24}], {activo:false, valor:0}, 0);
}
