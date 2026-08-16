/* ============================================================
   PESTANA: BALANCE (movimientos manuales de dinero)
   ============================================================ */

let balancePage = 1;
function setBalancePage(p){ balancePage = p; render(); window.scrollTo(0,0); }
function bolsaLabel(b){ return b==='inversion'?'Inversión':(b==='manoObra'?'Mano de obra':'Ganancia'); }
function renderBalance(){
  const movimientos = state.movimientos.slice().sort((a,b)=> new Date(b.fecha) - new Date(a.fecha) || b.creado.localeCompare(a.creado));
  const { items: movPage, page, totalPages } = paginar(movimientos, balancePage);
  balancePage = page;
  const rows = movPage.map(m=>`
    <tr>
      <td>${m.fecha}</td>
      <td><span class="status-pill ${m.tipo==='ingreso'?'status-ok':'status-out'}">${m.tipo==='ingreso'?'Ingreso externo':'Gasto'}</span></td>
      <td>${bolsaLabel(m.bolsa)}</td>
      <td class="num" style="font-weight:700;color:${m.tipo==='ingreso'?'inherit':'var(--red)'}">${m.tipo==='ingreso'?'+':'−'}${fmt(m.monto)}</td>
      <td>${m.motivo||'<span class="muted">(sin motivo)</span>'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteMovimiento('${m.id}')">Eliminar</button></td>
    </tr>
  `).join('');
  const totalIngresos = movimientos.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const totalGastos = movimientos.filter(m=>m.tipo==='gasto').reduce((s,m)=>s+m.monto,0);

  return `
    <div class="card">
      <h2>Balance — movimientos manuales</h2>
      <div class="sub">Para cuando compras algo que no sale de una receta (herramientas, arriendo, transporte, etc.) o cuando entra plata de afuera a alguna de las tres bolsas — por ejemplo un préstamo o un aporte para arrancar.</div>
      <div class="grid3">
        <div class="field"><label>Fecha</label><input id="mv-fecha" type="date" value="${today()}"></div>
        <div class="field"><label>Tipo</label>
          <select id="mv-tipo">
            <option value="gasto">Gasto (sale plata)</option>
            <option value="ingreso">Ingreso externo (entra plata, ej. préstamo)</option>
          </select>
        </div>
        <div class="field"><label>¿De cuál bolsa?</label>
          <select id="mv-bolsa">
            <option value="inversion">Inversión</option>
            <option value="manoObra">Mano de obra</option>
            <option value="ganancia">Ganancia</option>
          </select>
        </div>
      </div>
      <div class="grid2">
        <div class="field"><label>Monto</label><input id="mv-monto" type="number" min="0"></div>
        <div class="field"><label>Motivo (opcional)</label><input id="mv-motivo" type="text" placeholder="Ej. Compra de tijeras nuevas, préstamo para arranque..."></div>
      </div>
      <button class="btn btn-primary" onclick="registrarMovimientoUI()">Registrar movimiento</button>
    </div>
    <div class="card">
      <div class="section-head">
        <div><h2>Historial de movimientos</h2></div>
        <div style="text-align:right;font-size:12px" class="muted">Ingresos externos: ${fmt(totalIngresos)} · Gastos: ${fmt(totalGastos)}</div>
      </div>
      ${movimientos.length===0?`<div class="empty">Aún no has registrado movimientos manuales.</div>`:`
      <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Bolsa</th><th class="num">Monto</th><th>Motivo</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      ${paginacionHTML(page, totalPages, 'setBalancePage')}`}
    </div>
  `;
}
function registrarMovimientoUI(){
  const fecha = document.getElementById('mv-fecha').value || today();
  const tipo = document.getElementById('mv-tipo').value;
  const bolsa = document.getElementById('mv-bolsa').value;
  const monto = parseFloat(document.getElementById('mv-monto').value);
  const motivo = document.getElementById('mv-motivo').value.trim();
  if(!monto || monto<=0){ toast('Pon un monto válido'); return; }
  confirmarAntesDe('Vas a registrar este movimiento:', [
    ['Tipo', tipo==='ingreso'?'Ingreso externo':'Gasto'],
    ['Bolsa', bolsaLabel(bolsa)],
    ['Monto', fmt(monto)],
    ['Fecha', fecha],
    ['Motivo', motivo||'—'],
  ], ()=>{
    const delta = tipo==='ingreso' ? monto : -monto;
    state.totales[bolsa] += delta;
    state.movimientos.push({ id: uid(), fecha, tipo, bolsa, monto, motivo, creado: today() });
    logActividad('movimiento','registrar', `${tipo==='ingreso'?'Ingreso':'Gasto'} en ${bolsaLabel(bolsa)}: ${fmt(monto)}${motivo?' — '+motivo:''}`);
    saveState();
    balancePage = 1;
    toast(tipo==='ingreso' ? `Se sumaron ${fmt(monto)} a ${bolsaLabel(bolsa)}` : `Se restaron ${fmt(monto)} de ${bolsaLabel(bolsa)}`);
    render();
  });
}
function deleteMovimiento(id){
  const m = state.movimientos.find(x=>x.id===id); if(!m) return;
  confirmarAntesDe('¿Eliminar este movimiento?', [
    ['Tipo', m.tipo==='ingreso'?'Ingreso externo':'Gasto'],
    ['Bolsa', bolsaLabel(m.bolsa)],
    ['Monto', fmt(m.monto)],
    ['Advertencia', 'Se revierte el ajuste que hizo en la bolsa correspondiente.'],
  ], ()=>{
    const delta = m.tipo==='ingreso' ? -m.monto : m.monto;
    state.totales[m.bolsa] += delta;
    state.movimientos = state.movimientos.filter(x=>x.id!==id);
    logActividad('movimiento','eliminar', `Movimiento eliminado: ${bolsaLabel(m.bolsa)} ${fmt(m.monto)}`);
    saveState(); render();
  }, 'Sí, eliminar');
}
