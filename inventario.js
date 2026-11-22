/* ═══════════════════════════════════════════════════
   UNBROKEN. — inventario.js
   Gestión de prendas con tallas, stock, costo y precio
═══════════════════════════════════════════════════ */

const Inventario = (() => {

  // ── Render principal ───────────────────────────
  function render() {
    filtrar();
  }

  function filtrar() {
    const q      = (document.getElementById('inv-search')?.value || '').toLowerCase();
    const cat    = document.getElementById('inv-filter-cat')?.value || '';
    const estado = document.getElementById('inv-filter-estado')?.value || '';

    const data = DB.getDatos();
    let items = data.inventario || [];

    if (q)      items = items.filter(i => i.nombre.toLowerCase().includes(q) || (i.descripcion||'').toLowerCase().includes(q));
    if (cat)    items = items.filter(i => i.categoria === cat);
    if (estado === 'disponible') items = items.filter(i => _stockTotal(i) > 0);
    if (estado === 'agotado')    items = items.filter(i => _stockTotal(i) === 0);
    if (estado === 'bajo')       items = items.filter(i => { const t = _stockTotal(i); return t > 0 && t <= 3; });

    const lista = document.getElementById('inventario-lista');
    if (!lista) return;

    if (items.length === 0) {
      lista.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🧢</div><div class="empty-state-title">Sin prendas</div><div class="empty-state-sub">Agrega tu primera prenda al inventario</div></div>`;
      return;
    }

    lista.innerHTML = items.map(item => _cardHTML(item)).join('');
  }

  function _cardHTML(item) {
    const stockTotal = _stockTotal(item);
    const badgeClass = stockTotal === 0 ? 'stock-agotado-badge' : stockTotal <= 3 ? 'stock-bajo-badge' : 'stock-ok-badge';
    const badgeText  = stockTotal === 0 ? 'Agotado' : stockTotal <= 3 ? `Stock bajo (${stockTotal})` : `${stockTotal} uds`;

    const tallas = Object.entries(item.tallas || {});
    const tallasHTML = tallas.length > 0
      ? tallas.map(([t, q]) => {
          const cls = q === 0 ? 'stock-agotado' : q <= 2 ? 'stock-bajo' : 'stock-ok';
          return `<span class="talla-chip ${cls}" title="${t}: ${q} uds">${t}${q > 0 ? ` ×${q}` : ''}</span>`;
        }).join('')
      : '<span class="talla-chip">Sin tallas</span>';

    return `
      <div class="inv-card" onclick="Inventario.abrirModal('${item.id}')">
        <div class="inv-card-top">
          <span class="inv-nombre">${item.nombre}</span>
          <span class="inv-cat">${item.categoria || 'Otro'}</span>
        </div>
        <div class="inv-tallas">${tallasHTML}</div>
        <div class="inv-precios">
          <span class="inv-costo">Costo: ${_fmt(item.costo)}</span>
          <span class="inv-precio">${_fmt(item.precio)}</span>
        </div>
        <div style="margin-top:8px">
          <span class="inv-stock-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
  }

  // ── Modal crear/editar ─────────────────────────
  function abrirModal(itemId = null) {
    const data   = DB.getDatos();
    const item   = itemId ? data.inventario.find(i => i.id === itemId) : null;
    const tallas = data.config?.tallas || ['XS','S','M','L','XL','XXL'];

    const tallasRowsHTML = tallas.map(t => {
      const qty = item?.tallas?.[t] ?? 0;
      return `
        <div class="talla-row">
          <label>${t}</label>
          <input type="number" id="talla-${t}" value="${qty}" min="0" placeholder="0" />
        </div>
      `;
    }).join('');

    Modal.abrir(item ? 'Editar prenda' : 'Nueva prenda', `
      <div class="form-group">
        <label>Nombre de la prenda</label>
        <input type="text" id="inv-nombre" value="${item?.nombre || ''}" placeholder="Ej: Hoodie Unbroken Classic" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Categoría</label>
          <select id="inv-cat">
            ${['Camiseta','Hoodie','Pantalón','Short','Chaqueta','Accesorio','Otro'].map(c =>
              `<option value="${c}" ${item?.categoria === c ? 'selected' : ''}>${c}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Color</label>
          <input type="text" id="inv-color" value="${item?.color || ''}" placeholder="Negro, Blanco..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Costo unitario ($)</label>
          <input type="number" id="inv-costo" value="${item?.costo || ''}" placeholder="0" min="0" />
        </div>
        <div class="form-group">
          <label>Precio de venta ($)</label>
          <input type="number" id="inv-precio" value="${item?.precio || ''}" placeholder="0" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label>Descripción (opcional)</label>
        <textarea id="inv-desc" placeholder="Notas sobre la prenda...">${item?.descripcion || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Stock por talla</label>
        <div class="tallas-grid">${tallasRowsHTML}</div>
      </div>
      <div class="form-actions">
        ${item ? `<button class="btn btn-danger" onclick="Inventario.eliminar('${item.id}')">Eliminar</button>` : ''}
        <button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>
        <button class="btn btn-primary" onclick="Inventario.guardar('${itemId || ''}')">Guardar</button>
      </div>
    `);
  }

  // ── Guardar prenda ─────────────────────────────
  async function guardar(itemId) {
    const nombre = document.getElementById('inv-nombre')?.value.trim();
    const cat    = document.getElementById('inv-cat')?.value;
    const color  = document.getElementById('inv-color')?.value.trim();
    const costo  = parseFloat(document.getElementById('inv-costo')?.value) || 0;
    const precio = parseFloat(document.getElementById('inv-precio')?.value) || 0;
    const desc   = document.getElementById('inv-desc')?.value.trim();

    if (!nombre) { Toast.show('El nombre es obligatorio', 'error'); return; }

    const data   = DB.getDatos();
    const tallas = data.config?.tallas || ['XS','S','M','L','XL','XXL'];
    const tallasObj = {};
    tallas.forEach(t => {
      const v = parseInt(document.getElementById(`talla-${t}`)?.value) || 0;
      if (v > 0) tallasObj[t] = v; // Solo guardar tallas con stock > 0 (aún si es 0, lo guardamos)
      tallasObj[t] = v;
    });

    const ahora = new Date().toISOString();

    if (itemId) {
      const idx = data.inventario.findIndex(i => i.id === itemId);
      if (idx === -1) return;
      data.inventario[idx] = { ...data.inventario[idx], nombre, categoria: cat, color, costo, precio, descripcion: desc, tallas: tallasObj, actualizadoEn: ahora };
    } else {
      data.inventario.push({
        id: _uid(),
        nombre,
        categoria: cat,
        color,
        costo,
        precio,
        descripcion: desc,
        tallas: tallasObj,
        creadoEn: ahora,
        actualizadoEn: ahora
      });
    }

    await DB.guardarYPush(data);
    Modal.cerrar();
    render();
    Toast.show(itemId ? 'Prenda actualizada' : 'Prenda agregada', 'ok');
  }

  // ── Eliminar ───────────────────────────────────
  async function eliminar(itemId) {
    if (!confirm('¿Eliminar esta prenda del inventario?')) return;
    const data = DB.getDatos();
    data.inventario = data.inventario.filter(i => i.id !== itemId);
    await DB.guardarYPush(data);
    Modal.cerrar();
    render();
    Toast.show('Prenda eliminada', 'ok');
  }

  // ── Ajustar stock ──────────────────────────────
  function descontarStock(itemId, talla, cantidad = 1) {
    const data = DB.getDatos();
    const item = data.inventario.find(i => i.id === itemId);
    if (!item) return false;
    if (!item.tallas) item.tallas = {};
    const actual = item.tallas[talla] || 0;
    if (actual < cantidad) return false;
    item.tallas[talla] = actual - cantidad;
    item.actualizadoEn = new Date().toISOString();
    DB.setDatos(data);
    return true;
  }

  // ── Config tallas ──────────────────────────────
  async function guardarTallas() {
    const raw = document.getElementById('cfg-tallas')?.value || '';
    const tallas = raw.split(',').map(t => t.trim()).filter(Boolean);
    if (tallas.length === 0) { Toast.show('Ingresa al menos una talla', 'error'); return; }
    const data = DB.getDatos();
    if (!data.config) data.config = {};
    data.config.tallas = tallas;
    await DB.guardarYPush(data);
    Toast.show('Tallas guardadas', 'ok');
  }

  function cargarTallasEnUI() {
    const data = DB.getDatos();
    const inp = document.getElementById('cfg-tallas');
    if (inp) inp.value = (data.config?.tallas || ['XS','S','M','L','XL','XXL']).join(',');
  }

  // ── Dashboard: stock bajo ──────────────────────
  function renderStockBajo() {
    const lista = document.getElementById('dashboard-stock-bajo');
    if (!lista) return;
    const data = DB.getDatos();
    const bajos = (data.inventario || []).filter(i => {
      const t = _stockTotal(i);
      return t >= 0 && t <= 3;
    }).slice(0, 5);

    if (bajos.length === 0) {
      lista.innerHTML = `<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">Todo el inventario tiene stock suficiente 👍</div>`;
      return;
    }

    lista.innerHTML = bajos.map(i => {
      const t = _stockTotal(i);
      return `
        <div class="item-row" onclick="Inventario.abrirModal('${i.id}')">
          <div class="item-row-info">
            <div class="item-row-title">${i.nombre}</div>
            <div class="item-row-sub">${i.categoria} · ${i.color || 'Sin color'}</div>
          </div>
          <span class="inv-stock-badge ${t === 0 ? 'stock-agotado-badge' : 'stock-bajo-badge'}">${t === 0 ? 'Agotado' : t + ' uds'}</span>
        </div>
      `;
    }).join('');
  }

  // ── Utilidades ─────────────────────────────────
  function _stockTotal(item) {
    return Object.values(item.tallas || {}).reduce((a, b) => a + b, 0);
  }

  function getStockTotal(item) { return _stockTotal(item); }

  function _fmt(n) {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('es-CO');
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    render,
    filtrar,
    abrirModal,
    guardar,
    eliminar,
    guardarTallas,
    cargarTallasEnUI,
    renderStockBajo,
    getStockTotal,
    descontarStock
  };

})();
