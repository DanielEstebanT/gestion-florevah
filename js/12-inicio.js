/* ============================================================
   PESTANA: INICIO
   ============================================================ */

function renderInicio(){
  const pendientes = pedidosPendientesOrdenados();
  const criticos = insumosCriticosOrdenados();
  const totalPorCobrarValor = totalPorCobrar();
  const menuItems = [
    ['insumos','Insumos', `${state.insumos.length} registrados`],
    ['productos','Productos', `${state.productos.length} registrados`],
    ['pedidos','Pedidos', totalPorCobrarValor>0 ? `Por cobrar: ${fmt(totalPorCobrarValor)}` : `${state.pedidos.filter(p=>p.estado==='pendiente').length} pendientes`],
    ['analisis','Análisis', 'Qué se vende más'],
    ['balance','Balance', 'Ingresos/gastos manuales'],
    ['historial','Historial de precios', 'Sube o baja'],
    ['actividad','Registro de actividad', 'Qué se ha hecho'],
    ['resumen','Resumen', 'Ver totales'],
  ];
  const menuHTML = menuItems.map(([id,label,sub])=>`
    <button class="home-menu-item" onclick="setTab('${id}')">
      <div class="home-menu-label">${label}</div>
      <div class="home-menu-sub">${sub}</div>
    </button>
  `).join('');

  const pedidosHTML = pendientes.length===0 ? `<div class="empty">No hay pedidos pendientes 🌸</div>` : `
    <div class="table-wrap">
    <table>
      <thead><tr><th>Cliente</th><th>Productos</th><th>Entrega</th><th>Urgencia</th><th></th></tr></thead>
      <tbody>
      ${pendientes.slice(0,6).map(p=>{
        const dias = diasHasta(p.fechaEntrega);
        return `<tr>
          <td>${p.cliente}${p.notas?`<div class="caption">${p.notas}</div>`:''}</td>
          <td>${p.items.map(nombreProductoPedidoItem).join(', ')}</td>
          <td class="num">${p.fechaEntrega}</td>
          <td><span class="status-pill ${urgenciaClase(dias)}">${urgenciaTxt(dias)}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="setTab('pedidos')">Ver</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
    ${pendientes.length>6?`<div class="helptext">Y ${pendientes.length-6} pedido${pendientes.length-6===1?'':'s'} más — ve a la pestaña Pedidos.</div>`:''}
  `;

  const insumosHTML = criticos.length===0 ? `<div class="empty">Todo el inventario está en buen nivel 🌸</div>` : `
    <div class="table-wrap">
    <table>
      <thead><tr><th>Insumo</th><th class="num">Stock</th><th class="num">Umbral</th><th>Estado</th></tr></thead>
      <tbody>
      ${criticos.slice(0,8).map(i=>{
        const st = stockStatus(i);
        return `<tr>
          <td>${i.nombre}</td>
          <td class="num">${i.stockActual} ${i.unidad}</td>
          <td class="num">${i.stockMinimo} ${i.unidad}</td>
          <td><span class="status-pill ${st==='out'?'status-out':'status-low'}">${st==='out'?'Agotado':'Bajo'}</span></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    </div>
    ${criticos.length>8?`<div class="helptext">Y ${criticos.length-8} insumo${criticos.length-8===1?'':'s'} más bajo${criticos.length-8===1?'':'s'} — ve a la pestaña Insumos.</div>`:''}
  `;

  return `
    <div class="card">
      <h2>¿Qué quieres hacer?</h2>
      <div class="sub">Menú rápido de florevah.</div>
      <div class="home-menu-grid">${menuHTML}</div>
    </div>
    <div class="card">
      <div class="section-head"><div><h2>Pedidos pendientes</h2><div class="sub">Ordenados por fecha de entrega más próxima.</div></div>
        <button class="btn btn-ghost btn-sm" onclick="setTab('pedidos')">+ Nuevo pedido</button>
      </div>
      ${pedidosHTML}
    </div>
    <div class="card">
      <div class="section-head"><div><h2>Insumos por acabarse</h2><div class="sub">Lo más crítico primero.</div></div></div>
      ${insumosHTML}
    </div>
  `;
}
