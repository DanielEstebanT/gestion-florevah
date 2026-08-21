/* ============================================================
   ESTADO GLOBAL Y PERSISTENCIA — VERSIÓN FIREBASE
   El objeto `state` sigue siendo la única fuente de verdad para
   TODO lo que dibuja la pantalla (nada de esto cambia en el resto
   de la app). Lo que cambió es CÓMO se guarda:

   - Cada colección (insumos, productos, pedidos, movimientos,
     historialPrecios, actividad) vive en su propio documento de
     Firestore, así que dos personas editando cosas distintas al
     mismo tiempo ya no se pisan.
   - Los números que los dos podrían tocar a la vez (stock de
     insumos/productos, y los totales de inversión/mano de
     obra/ganancia) se ajustan con incrementos atómicos de
     Firestore, o con transacciones cuando el valor final depende
     de un cálculo (como el costo promedio de un insumo).
   - onSnapshot mantiene `state` sincronizado en tiempo real con
     lo que hace el otro celular, sin tener que preguntar cada
     20 segundos.

   PATRÓN QUE SE USA EN TODA LA APP (para que el resto del código
   no tenga que volverse async): cada función de negocio sigue
   editando `state` en memoria de inmediato (optimista, para que
   se sienta igual de rápido), y por debajo dispara la escritura
   a Firestore SIN esperarla ("dispara y olvida", con .catch para
   avisar si algo falla). onSnapshot es quien corrige cualquier
   diferencia poco después, y es quien te avisa de lo que hizo tu
   compañero/a.
   ============================================================ */

/* ---------------- 1. Configuración de Firebase ----------------
   Pega aquí la configuración de TU proyecto. La sacas así:
   1. https://console.firebase.google.com → crea un proyecto nuevo
      (recomendado: uno aparte del de florevah-cromos).
   2. Activa Firestore Database (modo producción) y Authentication
      → método "Anónimo".
   3. Configuración del proyecto (el engranaje) → baja hasta
      "Tus apps" → ícono web </> → registra la app → copia el
      objeto de acá abajo.
   Ver el final de este archivo para las reglas de seguridad que
   debes pegar en Firestore → pestaña "Reglas".
------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "PEGA_AQUI_TU_PROYECTO.firebaseapp.com",
  projectId: "PEGA_AQUI_TU_PROYECTO",
  storageBucket: "PEGA_AQUI_TU_PROYECTO.appspot.com",
  messagingSenderId: "PEGA_AQUI",
  appId: "PEGA_AQUI"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const FV = firebase.firestore.FieldValue; // atajo para increment()/etc.

/* ---------------- 2. Estado local (espejo en memoria de Firestore) ---------------- */
let state = { insumos: [], productos: [], ventas: [], pedidos: [], movimientos: [], historialPrecios: [], actividad: [], totales: { inversion:0, manoObraTradicional:0, manoObraDomicilio:0, ganancia:0 } };

const fmt = n => (isFinite(n)?n:0).toLocaleString('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
const uid = () => Math.random().toString(36).slice(2,10); // ya casi no se usa para ids (Firestore genera los suyos), pero se deja por si algo lo necesita como id temporal
const today = () => new Date().toISOString().slice(0,10);
const ahora = () => new Date().toISOString().slice(0,16).replace('T',' ');

/* Mientras se siembran datos de ejemplo o se restaura un respaldo, las funciones que ajustan
   stock/totales (fabricar, aplicarAbonoPedido, etc.) siguen editando `state` en memoria con
   total normalidad, pero NO disparan su escritura individual a Firestore — porque justo después
   se hace una escritura masiva con el estado ya completo y correcto (sembrarEnFirestore /
   reemplazarTodoEnFirestore). Si no se hiciera así, esos incrementos de fondo podrían sumarse
   ENCIMA de lo que ya había en Firestore antes de sembrar, duplicando los totales. */
let sembrando = false;

/* Historial de precios y actividad son registros que solo se agregan (nunca se editan ni se
   borran desde la UI), así que se guardan directo con un id generado localmente: se ven al
   instante en pantalla, y de fondo se escriben a Firestore sin bloquear nada. */
function logPrecio(tipo, refId, nombre, precioAnterior, precioNuevo, detalle){
  if(precioAnterior===precioNuevo) return;
  const ref = db.collection('historialPrecios').doc();
  const entry = { id: ref.id, tipo, refId, nombre, precioAnterior, precioNuevo, fecha: today(), detalle: detalle||'' };
  state.historialPrecios.push(entry);
  ref.set(entry).catch(err=>console.error('Error guardando historial de precio:', err));
}
function logActividad(entidad, accion, resumen){
  const ref = db.collection('actividad').doc();
  const entry = { id: ref.id, entidad, accion, resumen, fecha: today(), hora: ahora() };
  state.actividad.push(entry);
  ref.set(entry).catch(err=>console.error('Error guardando actividad:', err));
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

/* ---------------- 3. Escrituras por colección (insumos, productos, pedidos, movimientos) ----------------
   Guardan el documento completo — están bien para ediciones de formulario (nombre, receta, cliente,
   etc.), donde es normal que la última edición gane. NO se usan para números que se suman/restan
   seguido (eso va en la sección 4, con increment()/transacciones). */
function guardarInsumo(insumo){
  const ref = insumo.id ? db.collection('insumos').doc(insumo.id) : db.collection('insumos').doc();
  insumo.id = ref.id;
  ref.set(insumo).catch(err=>{ console.error('Error guardando insumo:', err); toast('No se pudo guardar en la nube — revisa tu conexión'); });
  return insumo;
}
function eliminarInsumoDoc(id){
  db.collection('insumos').doc(id).delete().catch(err=>console.error('Error eliminando insumo:', err));
}
function guardarProducto(producto){
  const ref = producto.id ? db.collection('productos').doc(producto.id) : db.collection('productos').doc();
  producto.id = ref.id;
  ref.set(producto).catch(err=>{ console.error('Error guardando producto:', err); toast('No se pudo guardar en la nube — revisa tu conexión'); });
  return producto;
}
function eliminarProductoDoc(id){
  db.collection('productos').doc(id).delete().catch(err=>console.error('Error eliminando producto:', err));
}
function guardarPedido(pedido){
  const ref = pedido.id ? db.collection('pedidos').doc(pedido.id) : db.collection('pedidos').doc();
  pedido.id = ref.id;
  ref.set(pedido).catch(err=>{ console.error('Error guardando pedido:', err); toast('No se pudo guardar en la nube — revisa tu conexión'); });
  return pedido;
}
function eliminarPedidoDoc(id){
  db.collection('pedidos').doc(id).delete().catch(err=>console.error('Error eliminando pedido:', err));
}
function guardarMovimiento(mov){
  const ref = mov.id ? db.collection('movimientos').doc(mov.id) : db.collection('movimientos').doc();
  mov.id = ref.id;
  ref.set(mov).catch(err=>{ console.error('Error guardando movimiento:', err); toast('No se pudo guardar en la nube — revisa tu conexión'); });
  return mov;
}
function eliminarMovimientoDoc(id){
  db.collection('movimientos').doc(id).delete().catch(err=>console.error('Error eliminando movimiento:', err));
}

/* ---------------- 4. Ajustes atómicos (a prueba de que los dos editen al tiempo) ---------------- */

/* Stock de insumo y de producto (sin variante): un simple increment() de Firestore ya es
   a prueba de carreras — si los dos fabrican al mismo tiempo, las dos restas se aplican bien. */
function ajustarStockInsumo(id, delta){
  if(!delta || sembrando) return;
  db.collection('insumos').doc(id).set({ stockActual: FV.increment(delta) }, {merge:true})
    .catch(err=>console.error('Error ajustando stock de insumo:', err));
}
function ajustarStockProducto(productoId, delta){
  if(!delta || sembrando) return;
  db.collection('productos').doc(productoId).set({ stock: FV.increment(delta) }, {merge:true})
    .catch(err=>console.error('Error ajustando stock de producto:', err));
}
/* El stock de una VARIANTE vive dentro de un arreglo (variantes[]), y Firestore no puede
   incrementar un número que está adentro de un arreglo directamente — por eso usamos una
   transacción: lee el documento completo, modifica solo esa variante, y lo vuelve a guardar.
   Si alguien más edita el mismo producto a mitad de camino, Firestore reintenta solo, así que
   sigue siendo seguro aunque no sea un increment() puro. */
function ajustarStockVarianteProducto(productoId, varianteId, delta){
  if(!delta || sembrando) return;
  const ref = db.collection('productos').doc(productoId);
  db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if(!snap.exists) return;
    const data = snap.data();
    const variantes = (data.variantes||[]).map(v=>{
      if(v.id!==varianteId) return v;
      return { ...v, stock: +(((v.stock||0)) + delta).toFixed(4) };
    });
    tx.update(ref, { variantes });
  }).catch(err=>console.error('Error ajustando stock de variante:', err));
}

/* Comprar un insumo cambia tres cosas juntas: stock, cantidad comprada acumulada, y el costo
   promedio (que es un valor DERIVADO: precioTotalComprado/cantidadComprada). Como el resultado
   depende de leer el valor actual antes de calcular, esto necesita una transacción, no un
   increment() simple — si no, dos compras al mismo tiempo podrían calcular mal el promedio. */
function registrarCompraInsumoDB(insumoId, cantidad, precio, onListo){
  const ref = db.collection('insumos').doc(insumoId);
  db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const nuevaCantidadComprada = +((data.cantidadComprada||0) + cantidad).toFixed(4);
    const nuevoPrecioTotal = +((data.precioTotalComprado||0) + precio).toFixed(2);
    const nuevoPrecioUnidad = nuevaCantidadComprada ? +(nuevoPrecioTotal/nuevaCantidadComprada).toFixed(2) : 0;
    tx.update(ref, {
      stockActual: FV.increment(cantidad),
      cantidadComprada: nuevaCantidadComprada,
      precioTotalComprado: nuevoPrecioTotal,
      precioUnidad: nuevoPrecioUnidad,
    });
    return { precioUnidadAntes: data.precioUnidad||0, precioUnidadNuevo: nuevoPrecioUnidad };
  }).then(resultado => { if(onListo) onListo(resultado); })
    .catch(err=>{ console.error('Error registrando compra:', err); toast('No se pudo registrar la compra — revisa tu conexión'); });
}

/* Los totales del negocio (inversión / mano de obra [tradicional y domicilio] / ganancia) viven
   en UN solo documento compartido por todos. SIEMPRE se tocan con increment() — nunca con una
   sobreescritura directa de todo el objeto — porque si no, la última persona en guardar borraría
   lo que la otra sumó mientras tanto. La única excepción es "establecerTotales", para cuando de
   verdad quieres reemplazar el valor completo (restaurar un respaldo, restablecer los datos de
   ejemplo). */
function ajustarTotales({inversion=0, manoObraTradicional=0, manoObraDomicilio=0, ganancia=0}){
  if(sembrando || (!inversion && !manoObraTradicional && !manoObraDomicilio && !ganancia)) return;
  db.collection('meta').doc('totales').set({
    inversion: FV.increment(inversion),
    manoObraTradicional: FV.increment(manoObraTradicional),
    manoObraDomicilio: FV.increment(manoObraDomicilio),
    ganancia: FV.increment(ganancia),
  }, {merge:true}).catch(err=>console.error('Error ajustando totales:', err));
}
function establecerTotales(valores){
  return db.collection('meta').doc('totales').set(valores);
}

/* ---------------- 5. Tiempo real: mantienen `state` al día con lo que hace el otro celular ---------------- */
function iniciarListeners(){
  db.collection('insumos').onSnapshot(snap=>{
    state.insumos = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando insumos:', err));

  db.collection('ventas').onSnapshot(snap=>{
    state.ventas = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando ventas:', err));

  db.collection('productos').onSnapshot(snap=>{
    state.productos = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando productos:', err));

  db.collection('pedidos').onSnapshot(snap=>{
    state.pedidos = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando pedidos:', err));

  db.collection('movimientos').onSnapshot(snap=>{
    state.movimientos = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando movimientos:', err));

  db.collection('historialPrecios').onSnapshot(snap=>{
    state.historialPrecios = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando historial de precios:', err));

  db.collection('actividad').onSnapshot(snap=>{
    state.actividad = snap.docs.map(d=>({id:d.id, ...d.data()}));
    if(loaded) render();
  }, err=>console.error('Error escuchando actividad:', err));

  db.collection('meta').doc('totales').onSnapshot(snap=>{
    if(snap.exists){
      const datos = snap.data();
      // Migración silenciosa: si en Firestore todavía queda el campo viejo "manoObra" (de antes
      // de dividirlo en tradicional/domicilio) y aún no se ha migrado, se pasa completo a
      // "tradicional" (la separación exacta ya no se puede reconstruir) y se guarda una sola vez.
      if(datos.manoObra !== undefined && datos.manoObraTradicional === undefined){
        const migrado = {
          inversion: datos.inversion||0,
          manoObraTradicional: datos.manoObra||0,
          manoObraDomicilio: 0,
          ganancia: datos.ganancia||0,
        };
        establecerTotales(migrado).catch(err=>console.error('Error migrando totales:', err));
        state.totales = migrado;
      } else {
        state.totales = { inversion:0, manoObraTradicional:0, manoObraDomicilio:0, ganancia:0, ...datos };
      }
    }
    if(loaded) render();
  }, err=>console.error('Error escuchando totales:', err));
}

/* ---------------- 6. Puente temporal para lo que aún no está convertido a escrituras finas ----------------
   Productos, Pedidos, Análisis, Historial, Actividad y Resumen todavía llaman a saveState() como
   antes (guardar TODO de una). Mientras se van convirtiendo uno por uno, saveState() sigue
   funcionando: sincroniza cada colección completa a Firestore. No toca "meta/totales" nunca
   (eso es SIEMPRE por incrementos, ver arriba), para no arriesgarse a pisar un ajuste reciente. */
/* A esta altura de la migración, todo (insumos, productos, pedidos, movimientos, totales) ya
   se guarda con su función dedicada. Lo único que sigue usando este "guardado genérico" es el
   caso heredado de abonar una venta antigua (de antes de unificar todo en Pedidos) — por eso
   ahora solo sincroniza `ventas`. */
function saveState(){
  const batch = db.batch();
  state.ventas.forEach(v => batch.set(db.collection('ventas').doc(v.id), v));
  batch.commit().catch(err=>{ console.error('Error guardando venta antigua:', err); toast('No se pudo guardar (revisa tu conexión)'); });
}

/* Escribe TODO lo que generó seed() de una sola vez, para la primera vez que se usa la base de
   datos. Usa bloques de máximo 450 operaciones (el límite real de Firestore es 500 por batch). */
async function sembrarEnFirestore(){
  const todo = [
    ...state.insumos.map(x=>['insumos',x]),
    ...state.productos.map(x=>['productos',x]),
    ...state.pedidos.map(x=>['pedidos',x]),
    ...state.historialPrecios.map(x=>['historialPrecios',x]),
    ...state.actividad.map(x=>['actividad',x]),
  ];
  for(let i=0;i<todo.length;i+=450){
    const trozo = todo.slice(i, i+450);
    const batch = db.batch();
    trozo.forEach(([col, doc])=> batch.set(db.collection(col).doc(doc.id), doc));
    await batch.commit();
  }
  // Se establece al final y de forma explícita (no con increment) para que quede exacto,
  // incluso si algún ajuste atómico se disparó de fondo mientras se sembraba.
  await establecerTotales(state.totales);
}

/* Para "Restaurar respaldo" y "Restablecer datos de ejemplo": a diferencia de saveState()
   (que solo agrega/actualiza), esto también BORRA de Firestore lo que ya no esté en el nuevo
   estado, y sí sobreescribe "meta/totales" directo (sin increment), porque aquí sí es correcto
   reemplazar todo por completo — es justo lo que el usuario pidió al restaurar o restablecer. */
async function reemplazarTodoEnFirestore(nuevoState){
  const colecciones = ['insumos','productos','pedidos','movimientos','historialPrecios','actividad','ventas'];
  for(const col of colecciones){
    const actuales = await db.collection(col).get();
    const idsNuevos = new Set((nuevoState[col]||[]).map(x=>x.id));
    const batch = db.batch();
    let hayOperaciones = false;
    actuales.docs.forEach(d=>{
      if(!idsNuevos.has(d.id)){ batch.delete(db.collection(col).doc(d.id)); hayOperaciones = true; }
    });
    (nuevoState[col]||[]).forEach(doc=>{
      batch.set(db.collection(col).doc(doc.id), doc); hayOperaciones = true;
    });
    if(hayOperaciones) await batch.commit();
  }
  await establecerTotales(nuevoState.totales || {inversion:0, manoObraTradicional:0, manoObraDomicilio:0, ganancia:0});
}

/* ---------------- 7. Arranque y sesión ----------------
   Antes cualquiera que abriera la app entraba "anónimo" automático — eso significa que
   cualquiera que encontrara la URL tenía las mismas llaves que ustedes dos. Ahora se pide
   correo y contraseña de verdad (las cuentas se crean a mano en Firebase console →
   Authentication → método "Correo/contraseña"), y solo esas cuentas pueden entrar. */
let usuarioActual = null;

function iniciarApp(){
  auth.onAuthStateChanged(async (user) => {
    usuarioActual = user;
    if(user){
      await cargarDatosIniciales();
    } else {
      loaded = true; // para que se muestre la pantalla de login en vez de "Cargando..."
    }
    render();
  });
}

async function cargarDatosIniciales(){
  try{
    const totalesSnap = await db.collection('meta').doc('totales').get();
    if(!totalesSnap.exists){
      sembrando = true;
      seed(); // arma los datos de ejemplo en memoria, tal como siempre
      await sembrarEnFirestore();
      sembrando = false;
    }
  }catch(err){
    console.error('Error inicializando datos:', err);
    sembrando = false;
  }
  iniciarListeners();
  loaded = true;
}

/* "Recuérdame" = la sesión sobrevive a cerrar el navegador (persistencia LOCAL).
   Sin marcar = la sesión se borra al cerrar la pestaña (persistencia SESSION), útil si
   alguna vez entran desde un celular/computador que no es el suyo. */
function iniciarSesion(email, password, recordar){
  const persistencia = recordar ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
  return auth.setPersistence(persistencia)
    .then(()=> auth.signInWithEmailAndPassword(email, password));
}
function cerrarSesion(){
  auth.signOut();
}

/* Ya no hace falta preguntar cada 20 segundos "¿hay algo nuevo?" — onSnapshot avisa al instante.
   hayFormularioAbierto() se deja solo por si en el futuro se necesita evitar algún refresco
   mientras hay un formulario abierto (por ejemplo, si se agrega alguna sincronización manual). */
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

  state.totales = { inversion:0, manoObraTradicional:0, manoObraDomicilio:0, ganancia:0 };
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
      if(variante){
        variante.stock = +(((variante.stock||0)) - it.cantidad).toFixed(4);
        ajustarStockVarianteProducto(prod.id, variante.id, -it.cantidad);
      } else {
        prod.stock = +(((prod.stock||0)) - it.cantidad).toFixed(4);
        ajustarStockProducto(prod.id, -it.cantidad);
      }
    });
    const pedido = { id: uid(), cliente, telefono, fechaEntrega, notas, estado:'pendiente', items, domicilio: domicilio||{activo:false,valor:0}, costoInversion, costoManoObraBase, abono:0, aplicado:{inv:0,moTrad:0,moDom:0,gan:0}, saldoPendiente:0, creado: today() };
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

/* ============================================================
   REGLAS DE SEGURIDAD DE FIRESTORE (pégalas en la consola de
   Firebase → Firestore Database → pestaña "Reglas"):

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }

   Esto permite leer/escribir solo a quien haya iniciado sesión
   (aunque sea anónima, como hace esta app) — bloquea a cualquiera
   que no haya pasado por tu app.
   ============================================================ */
