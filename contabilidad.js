/* ═══════════════════════════════════════════════════
   UNBROKEN. — contabilidad.js
   Ventas, costos personalizables y cálculo de ganancias
═══════════════════════════════════════════════════ */

const Contabilidad = (() => {

  // ══════════════════════════════════════════
  // VENTAS
  // ══════════════════════════════════════════

  function renderVentas() {
    _poblarSelectMes();
    filtrarMes();
  }

  function filtrarMes() {
    const mes = document.getElementById('ventas-filter-mes')?.value || _mesActual();
    const data = DB.getDatos();
    const ventas = (data.ventas || []).filter(v => v.mes === mes);

    // Resumen
    let ingresos = 0, costosTotales = 0;
    ventas.forEach(v => {
      ingresos += v.total || 0;
      costosTotales += v.costoTotal || 0;
    });
    const ganancia = ingresos - costosTotales;
    const margen = ingresos > 0 ? Math.round((ganancia / ingresos) * 100) : 0;

    document.getElementById('res-ingresos').textContent = _fmt(ingresos);
    document.getElementById('res-costos').textContent   = _fmt(costosTotales);
    document.getElementById('res-ganancia').textContent = _fmt(ganancia);
    document.getElementById('res-margen').textContent   = margen + '%';
    document.getElementById('res-ganancia').style.color = ganancia >= 0 ? 'var(--green)' : 'var(--red)';

    const lista = document.getElementById('ventas-lista');
    if (!lista) return;

    if (ventas.length === 0) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Sin ventas este mes</div><div class="empty-state-sub">Registra tu primera venta</div></div>`;
      return;
    }

    // Ordenar más reciente primero
    const ordenadas = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    lista.innerHTML = ordenadas.map(v => _ventaCardHTML(v)).join('');
  }

  function _ventaCardHTML(v) {
    const ganancia = (v.total || 0) - (v.costoTotal || 0);
    const fecha = new Date(v.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'short' });
    const canal = v.canal === 'online' ? '<span class="venta-canal canal-online">Online</span>' : '<span class="venta-canal canal-fisico">Físico</span>';
    const itemsText = (v.items || []).map(i => `${i.nombre} ${i.talla ? `(${i.talla})` : ''}`).join(', ');

    return `
      <div class="venta-card" onclick="Contabilidad.abrirDetalleVenta('${v.id}')">
        <div class="venta-top">
          <div>
            <div class="venta-nombre">${v.cliente || 'Venta directa'}</div>
            <div class="venta-meta">
              <span>${fecha}</span>
              ${canal}
              <span>${itemsText || 'Sin productos'}</span>
            </div>
          </div>
          <div style="text-align:right">
            <div class="venta-total">${_fmt(v.total)}</div>
            <div class="venta-ganancia">+${_fmt(ganancia)}</div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Modal nueva venta ──────────────────────────
  function abrirNuevaVenta() {
    const data = DB.getDatos();
    const hoy  = new Date().toISOString().slice(0, 10);
    const categCosto = data.config?.categoriasCosto || [];

    // Construir opciones de productos
    const optsProducto = (data.inventario || []).map(i =>
      `<option value="${i.id}">${i.nombre} — ${_fmt(i.precio)}</option>`
    ).join('');

    // Categorías de costo predefinidas como filas
    const costosIniciales = [
      { cat: 'Envío', valor: 0 },
      ...categCosto.filter(c => c !== 'Envío' && c !== 'Arriendo' && c !== 'Nómina').slice(0, 2).map(c => ({ cat: c, valor: 0 }))
    ];

    Modal.abrir('Nueva venta', `
      <div class="form-row">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="v-fecha" value="${hoy}" />
        </div>
        <div class="form-group">
          <label>Canal</label>
          <select id="v-canal">
            <option value="fisico">Físico</option>
            <option value="online">Online</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Cliente (opcional)</label>
        <input type="text" id="v-cliente" placeholder="Nombre del cliente" />
      </div>

      <div class="form-group">
        <label>Productos vendidos</label>
        <div id="v-items-lista" class="venta-items-lista"></div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%" onclick="Contabilidad.agregarItemVenta()">+ Agregar producto</button>
      </div>

      <div class="form-group">
        <label>Costos de esta venta</label>
        <div id="v-costos-lista" class="costos-venta-wrap">
          ${costosIniciales.map((c, idx) => _costoRowHTML(c.cat, c.valor, idx)).join('')}
        </div>
        <div class="inline-add" style="margin-top:8px">
          <select id="v-nueva-cat-select">
            ${categCosto.map(c => `<option value="${c}">${c}</option>`).join('')}
            <option value="__custom">Otro (escribir)</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="Contabilidad.agregarCostoRow()">+ Costo</button>
        </div>
      </div>

      <div class="form-group">
        <label>Notas</label>
        <textarea id="v-notas" placeholder="Observaciones de la venta..."></textarea>
      </div>

      <div id="v-totales" class="totales-venta"></div>

      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>
        <button class="btn btn-primary" onclick="Contabilidad.guardarVenta()">Registrar venta</button>
      </div>
    `);

    _actualizarTotales();
  }

  let _itemsVentaTemp = [];
  let _costosVentaTemp = [];

  function agregarItemVenta() {
    const data = DB.getDatos();
    const inv  = data.inventario || [];
    if (inv.length === 0) { Toast.show('Agrega productos al inventario primero', 'warn'); return; }

    const idx = _itemsVentaTemp.length;
    _itemsVentaTemp.push({ productoId: '', talla: '', cantidad: 1, precio: 0 });

    const opts = inv.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'venta-item-row';
    row.id = `item-row-${idx}`;
    row.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <select onchange="Contabilidad.onItemProductoChange(${idx}, this.value)">
          <option value="">Seleccionar prenda...</option>
          ${opts}
        </select>
        <div style="display:flex;gap:6px">
          <select id="item-talla-${idx}" style="flex:1" onchange="Contabilidad._itemChange(${idx})">
            <option value="">Talla</option>
          </select>
          <input type="number" id="item-cant-${idx}" value="1" min="1" style="width:60px" placeholder="Cant" oninput="Contabilidad._itemChange(${idx})" />
          <input type="number" id="item-precio-${idx}" placeholder="Precio" style="width:90px" oninput="Contabilidad._itemChange(${idx})" />
        </div>
      </div>
      <button class="btn btn-danger btn-icon" onclick="Contabilidad.quitarItemVenta(${idx})">✕</button>
    `;
    document.getElementById('v-items-lista')?.appendChild(row);
  }

  function onItemProductoChange(idx, productoId) {
    const data = DB.getDatos();
    const item = data.inventario.find(i => i.id === productoId);
    _itemsVentaTemp[idx] = _itemsVentaTemp[idx] || {};
    _itemsVentaTemp[idx].productoId = productoId;
    _itemsVentaTemp[idx].precio = item?.precio || 0;

    // Poblar tallas disponibles
    const selTalla = document.getElementById(`item-talla-${idx}`);
    if (selTalla && item) {
      const tallas = Object.entries(item.tallas || {}).filter(([t, q]) => q > 0);
      selTalla.innerHTML = `<option value="">Talla</option>` +
        tallas.map(([t, q]) => `<option value="${t}">${t} (${q} disp.)</option>`).join('');
    }

    const precioInput = document.getElementById(`item-precio-${idx}`);
    if (precioInput) precioInput.value = item?.precio || 0;

    _actualizarTotales();
  }

  function _itemChange(idx) {
    const talla  = document.getElementById(`item-talla-${idx}`)?.value;
    const cant   = parseInt(document.getElementById(`item-cant-${idx}`)?.value) || 1;
    const precio = parseFloat(document.getElementById(`item-precio-${idx}`)?.value) || 0;
    if (_itemsVentaTemp[idx]) {
      _itemsVentaTemp[idx].talla = talla;
      _itemsVentaTemp[idx].cantidad = cant;
      _itemsVentaTemp[idx].precio = precio;
    }
    _actualizarTotales();
  }

  function quitarItemVenta(idx) {
    _itemsVentaTemp[idx] = null;
    document.getElementById(`item-row-${idx}`)?.remove();
    _actualizarTotales();
  }

  function _costoRowHTML(cat, valor, idx) {
    return `
      <div class="costo-venta-row" id="costo-row-${idx}">
        <input type="text" value="${cat}" id="costo-cat-${idx}" style="flex:1;min-width:0" placeholder="Concepto" oninput="Contabilidad._costoChange(${idx})" />
        <input type="number" value="${valor}" id="costo-val-${idx}" style="width:100px" placeholder="$0" min="0" oninput="Contabilidad._costoChange(${idx})" />
        <button class="btn btn-ghost btn-icon btn-sm" onclick="Contabilidad.quitarCostoRow(${idx})">✕</button>
      </div>
    `;
  }

  function agregarCostoRow() {
    const catSel = document.getElementById('v-nueva-cat-select')?.value;
    const idx = (_costosVentaTemp.length) + 10 + Date.now() % 1000; // ID único
    _costosVentaTemp.push({ cat: catSel === '__custom' ? '' : catSel, valor: 0, idx });
    const wrap = document.getElementById('v-costos-lista');
    if (!wrap) return;
    const div = document.createElement('div');
    div.innerHTML = _costoRowHTML(catSel === '__custom' ? '' : catSel, 0, idx);
    wrap.appendChild(div.firstElementChild);
  }

  function _costoChange(idx) {
    // No necesitamos guardar temporalmente, se lee al guardar
    _actualizarTotales();
  }

  function quitarCostoRow(idx) {
    document.getElementById(`costo-row-${idx}`)?.remove();
    _actualizarTotales();
  }

  function _leerItemsDelForm() {
    const data = DB.getDatos();
    const rows = document.querySelectorAll('.venta-item-row');
    const items = [];
    rows.forEach(row => {
      const idx = row.id.replace('item-row-', '');
      const productoId = _itemsVentaTemp[idx]?.productoId;
      if (!productoId) return;
      const prod = data.inventario.find(i => i.id === productoId);
      const talla  = document.getElementById(`item-talla-${idx}`)?.value || '';
      const cant   = parseInt(document.getElementById(`item-cant-${idx}`)?.value) || 1;
      const precio = parseFloat(document.getElementById(`item-precio-${idx}`)?.value) || 0;
      items.push({
        productoId,
        nombre: prod?.nombre || 'Prenda',
        talla,
        cantidad: cant,
        precio,
        costoUnitario: prod?.costo || 0,
        subtotal: precio * cant
      });
    });
    return items;
  }

  function _leerCostosDelForm() {
    const rows = document.querySelectorAll('.costo-venta-row');
    const costos = [];
    rows.forEach(row => {
      const idx = row.id.replace('costo-row-', '');
      const cat = document.getElementById(`costo-cat-${idx}`)?.value.trim();
      const val = parseFloat(document.getElementById(`costo-val-${idx}`)?.value) || 0;
      if (cat && val > 0) costos.push({ concepto: cat, valor: val });
    });
    return costos;
  }

  function _actualizarTotales() {
    const items  = _leerItemsDelForm();
    const costos = _leerCostosDelForm();
    const data   = DB.getDatos();

    const ingresos       = items.reduce((a, i) => a + i.subtotal, 0);
    const costoPrendas   = items.reduce((a, i) => a + (i.costoUnitario * i.cantidad), 0);
    const costoAdicional = costos.reduce((a, c) => a + c.valor, 0);
    const costoTotal     = costoPrendas + costoAdicional;
    const ganancia       = ingresos - costoTotal;
    const margen         = ingresos > 0 ? Math.round((ganancia / ingresos) * 100) : 0;

    const totalesEl = document.getElementById('v-totales');
    if (!totalesEl) return;
    totalesEl.innerHTML = `
      <div class="total-row"><span>Ingresos</span><span>${_fmt(ingresos)}</span></div>
      <div class="total-row"><span>Costo prendas</span><span>${_fmt(costoPrendas)}</span></div>
      <div class="total-row"><span>Costos adicionales</span><span>${_fmt(costoAdicional)}</span></div>
      <div class="total-row total-final"><span>Total recibido</span><span>${_fmt(ingresos)}</span></div>
      <div class="total-row total-ganancia"><span>Ganancia neta (${margen}%)</span><span>${_fmt(ganancia)}</span></div>
    `;
  }

  async function guardarVenta() {
    const fecha   = document.getElementById('v-fecha')?.value;
    const canal   = document.getElementById('v-canal')?.value;
    const cliente = document.getElementById('v-cliente')?.value.trim();
    const notas   = document.getElementById('v-notas')?.value.trim();
    const items   = _leerItemsDelForm();
    const costos  = _leerCostosDelForm();

    if (!fecha) { Toast.show('Selecciona la fecha', 'error'); return; }
    if (items.length === 0) { Toast.show('Agrega al menos un producto', 'error'); return; }

    const ingresos       = items.reduce((a, i) => a + i.subtotal, 0);
    const costoPrendas   = items.reduce((a, i) => a + (i.costoUnitario * i.cantidad), 0);
    const costoAdicional = costos.reduce((a, c) => a + c.valor, 0);
    const costoTotal     = costoPrendas + costoAdicional;

    const data = DB.getDatos();

    // Descontar stock
    items.forEach(item => {
      if (item.talla) Inventario.descontarStock(item.productoId, item.talla, item.cantidad);
    });

    const mes = fecha.slice(0, 7); // YYYY-MM

    data.ventas = data.ventas || [];
    data.ventas.push({
      id: _uid(),
      fecha,
      mes,
      canal,
      cliente,
      notas,
      items,
      costos,
      total: ingresos,
      costoPrendas,
      costoAdicional,
      costoTotal,
      ganancia: ingresos - costoTotal,
      registradoPor: Auth.getUsuarioActual()?.username || 'sistema',
      creadoEn: new Date().toISOString()
    });

    _itemsVentaTemp = [];
    _costosVentaTemp = [];

    await DB.guardarYPush(data);
    Modal.cerrar();
    renderVentas();
    Dashboard.render();
    Toast.show('Venta registrada 🎉', 'ok');
  }

  // ── Detalle de venta ───────────────────────────
  function abrirDetalleVenta(ventaId) {
    const data  = DB.getDatos();
    const venta = data.ventas.find(v => v.id === ventaId);
    if (!venta) return;

    const fecha = new Date(venta.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

    const itemsHTML = (venta.items || []).map(i => `
      <div class="venta-item-row">
        <div class="venta-item-info">
          <div>${i.nombre}</div>
          <div class="venta-item-sub">${i.talla ? `Talla: ${i.talla} · ` : ''}Cantidad: ${i.cantidad}</div>
        </div>
        <div class="venta-item-precio">${_fmt(i.subtotal)}</div>
      </div>
    `).join('');

    const costosHTML = (venta.costos || []).map(c => `
      <div class="total-row"><span>${c.concepto}</span><span>${_fmt(c.valor)}</span></div>
    `).join('');

    Modal.abrir('Detalle de venta', `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">
        <span class="venta-canal ${venta.canal === 'online' ? 'canal-online' : 'canal-fisico'}">${venta.canal === 'online' ? 'Online' : 'Físico'}</span>
        <span style="color:var(--text-secondary);font-size:13px">${fecha}</span>
        ${venta.cliente ? `<span style="font-size:13px">👤 ${venta.cliente}</span>` : ''}
      </div>

      <div class="form-group">
        <label>Productos</label>
        <div class="venta-items-lista">${itemsHTML}</div>
      </div>

      ${venta.costos?.length ? `
      <div class="form-group">
        <label>Costos adicionales</label>
        <div class="totales-venta">${costosHTML}</div>
      </div>` : ''}

      <div class="totales-venta">
        <div class="total-row"><span>Ingresos</span><span>${_fmt(venta.total)}</span></div>
        <div class="total-row"><span>Costo prendas</span><span>${_fmt(venta.costoPrendas)}</span></div>
        <div class="total-row"><span>Costos adicionales</span><span>${_fmt(venta.costoAdicional)}</span></div>
        <div class="total-row total-ganancia"><span>Ganancia neta</span><span>${_fmt(venta.ganancia)}</span></div>
      </div>

      ${venta.notas ? `<div style="color:var(--text-secondary);font-size:13px;padding:4px 0">📝 ${venta.notas}</div>` : ''}

      <div style="font-size:11px;color:var(--text-muted)">Registrado por: ${venta.registradoPor || '—'}</div>

      <div class="form-actions">
        <button class="btn btn-danger" onclick="Contabilidad.eliminarVenta('${ventaId}')">Eliminar</button>
        <button class="btn btn-ghost" onclick="Modal.cerrar()">Cerrar</button>
      </div>
    `);
  }

  async function eliminarVenta(ventaId) {
    if (!confirm('¿Eliminar esta venta? El stock no se restaura automáticamente.')) return;
    const data = DB.getDatos();
    data.ventas = data.ventas.filter(v => v.id !== ventaId);
    await DB.guardarYPush(data);
    Modal.cerrar();
    renderVentas();
    Dashboard.render();
    Toast.show('Venta eliminada', 'ok');
  }

  // ══════════════════════════════════════════
  // COSTOS GLOBALES
  // ══════════════════════════════════════════

  const Costos = {
    render() {
      const data = DB.getDatos();
      const costos = data.costos || [];
      const categs = data.config?.categoriasCosto || [];

      // Chips de categoría con total
      const catsEl = document.getElementById('costos-categorias');
      if (catsEl) {
        const totalesCat = {};
        costos.forEach(c => { totalesCat[c.categoria] = (totalesCat[c.categoria] || 0) + c.valor; });
        catsEl.innerHTML = `
          <div class="costo-cat-chip active" onclick="Costos._filtrar('')">
            Todos <span class="costo-cat-total">${_fmt(costos.reduce((a,c)=>a+c.valor,0))}</span>
          </div>
          ${categs.map(cat => `
            <div class="costo-cat-chip" onclick="Costos._filtrar('${cat}')">
              ${cat} <span class="costo-cat-total">${_fmt(totalesCat[cat] || 0)}</span>
            </div>
          `).join('')}
        `;
        // Render de config categorías
        Costos._renderConfigCats();
      }

      Costos._filtrar('');
    },

    _filtrar(cat) {
      // Resaltar chip activo
      document.querySelectorAll('.costo-cat-chip').forEach(el => el.classList.remove('active'));
      const chips = document.querySelectorAll('.costo-cat-chip');
      chips.forEach(el => { if (el.textContent.trim().startsWith(cat || 'Todos')) el.classList.add('active'); });

      const data = DB.getDatos();
      let costos = data.costos || [];
      if (cat) costos = costos.filter(c => c.categoria === cat);
      costos = [...costos].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

      const lista = document.getElementById('costos-lista');
      if (!lista) return;

      if (costos.length === 0) {
        lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-title">Sin costos registrados</div><div class="empty-state-sub">Agrega envíos, empaques y otros gastos</div></div>`;
        return;
      }

      lista.innerHTML = costos.map(c => `
        <div class="item-row" onclick="Costos.abrirModal('${c.id}')">
          <div class="item-row-info">
            <div class="item-row-title">${c.descripcion || c.categoria}</div>
            <div class="item-row-sub">${c.categoria} · ${new Date(c.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</div>
          </div>
          <span class="item-row-valor">${_fmt(c.valor)}</span>
        </div>
      `).join('');
    },

    abrirModal(costoId = null) {
      const data  = DB.getDatos();
      const costo = costoId ? (data.costos || []).find(c => c.id === costoId) : null;
      const categs = data.config?.categoriasCosto || [];
      const hoy = new Date().toISOString().slice(0,10);

      Modal.abrir(costo ? 'Editar costo' : 'Registrar costo', `
        <div class="form-group">
          <label>Categoría</label>
          <select id="c-cat">
            ${categs.map(cat => `<option value="${cat}" ${costo?.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" id="c-desc" value="${costo?.descripcion || ''}" placeholder="Ej: Envío pedido cliente Juan" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Valor ($)</label>
            <input type="number" id="c-valor" value="${costo?.valor || ''}" placeholder="0" min="0" />
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="c-fecha" value="${costo?.fecha || hoy}" />
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="c-notas" placeholder="Notas adicionales...">${costo?.notas || ''}</textarea>
        </div>
        <div class="form-actions">
          ${costo ? `<button class="btn btn-danger" onclick="Costos.eliminar('${costoId}')">Eliminar</button>` : ''}
          <button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>
          <button class="btn btn-primary" onclick="Costos.guardar('${costoId || ''}')">Guardar</button>
        </div>
      `);
    },

    async guardar(costoId) {
      const cat   = document.getElementById('c-cat')?.value;
      const desc  = document.getElementById('c-desc')?.value.trim();
      const valor = parseFloat(document.getElementById('c-valor')?.value) || 0;
      const fecha = document.getElementById('c-fecha')?.value;
      const notas = document.getElementById('c-notas')?.value.trim();

      if (!valor) { Toast.show('Ingresa un valor', 'error'); return; }
      if (!fecha) { Toast.show('Selecciona la fecha', 'error'); return; }

      const data = DB.getDatos();
      data.costos = data.costos || [];

      if (costoId) {
        const idx = data.costos.findIndex(c => c.id === costoId);
        if (idx !== -1) data.costos[idx] = { ...data.costos[idx], categoria: cat, descripcion: desc, valor, fecha, notas };
      } else {
        data.costos.push({ id: _uid(), categoria: cat, descripcion: desc, valor, fecha, notas, creadoEn: new Date().toISOString() });
      }

      await DB.guardarYPush(data);
      Modal.cerrar();
      Costos.render();
      Toast.show('Costo guardado', 'ok');
    },

    async eliminar(costoId) {
      if (!confirm('¿Eliminar este costo?')) return;
      const data = DB.getDatos();
      data.costos = data.costos.filter(c => c.id !== costoId);
      await DB.guardarYPush(data);
      Modal.cerrar();
      Costos.render();
      Toast.show('Costo eliminado', 'ok');
    },

    async agregarCategoria() {
      const inp = document.getElementById('cfg-nueva-cat');
      const cat = inp?.value.trim();
      if (!cat) return;
      const data = DB.getDatos();
      if (!data.config) data.config = {};
      if (!data.config.categoriasCosto) data.config.categoriasCosto = [];
      if (data.config.categoriasCosto.includes(cat)) { Toast.show('Ya existe esa categoría', 'warn'); return; }
      data.config.categoriasCosto.push(cat);
      await DB.guardarYPush(data);
      if (inp) inp.value = '';
      Costos._renderConfigCats();
      Toast.show('Categoría agregada', 'ok');
    },

    _renderConfigCats() {
      const el = document.getElementById('cfg-cats-lista');
      if (!el) return;
      const data = DB.getDatos();
      const cats = data.config?.categoriasCosto || [];
      el.innerHTML = cats.map(c => `
        <div class="item-row">
          <div class="item-row-info"><div class="item-row-title">${c}</div></div>
          <button class="btn btn-ghost btn-sm" onclick="Costos.eliminarCat('${c}')">✕</button>
        </div>
      `).join('');
    },

    async eliminarCat(cat) {
      const data = DB.getDatos();
      if (!data.config?.categoriasCosto) return;
      data.config.categoriasCosto = data.config.categoriasCosto.filter(c => c !== cat);
      await DB.guardarYPush(data);
      Costos._renderConfigCats();
      Toast.show('Categoría eliminada', 'ok');
    }
  };

  // ── Utilidades ─────────────────────────────────
  function _poblarSelectMes() {
    const sel = document.getElementById('ventas-filter-mes');
    if (!sel) return;
    const data = DB.getDatos();
    const meses = [...new Set((data.ventas || []).map(v => v.mes))].sort().reverse();
    const actual = _mesActual();
    if (!meses.includes(actual)) meses.unshift(actual);
    sel.innerHTML = meses.map(m => `<option value="${m}" ${m === actual ? 'selected' : ''}>${_fmtMes(m)}</option>`).join('');
  }

  function _mesActual() {
    return new Date().toISOString().slice(0, 7);
  }

  function _fmtMes(mes) {
    const [y, m] = mes.split('-');
    const nombres = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${nombres[parseInt(m)]} ${y}`;
  }

  function _fmt(n) {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('es-CO');
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Exponer Costos globalmente
  window.Costos = Costos;

  return {
    renderVentas,
    filtrarMes,
    abrirNuevaVenta,
    agregarItemVenta,
    onItemProductoChange,
    _itemChange,
    quitarItemVenta,
    agregarCostoRow,
    _costoChange,
    quitarCostoRow,
    guardarVenta,
    abrirDetalleVenta,
    eliminarVenta
  };

})();
