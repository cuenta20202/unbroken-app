/* ═══════════════════════════════════════════════════
   UNBROKEN. — inventario.js  v4
   Foto · Colores · Stock · USD/COP con TRM
═══════════════════════════════════════════════════ */

var Inventario = (function() {

  /* colores disponibles con hex para mostrar el swatch */
  var COLORES = [
    { nombre: 'Negro',    hex: '#1A1A1A' },
    { nombre: 'Blanco',   hex: '#F5F5F5' },
    { nombre: 'Gris',     hex: '#808080' },
    { nombre: 'Azul',     hex: '#1E3EFF' },
    { nombre: 'Azul marino', hex: '#0A1F44' },
    { nombre: 'Rojo',     hex: '#E74C3C' },
    { nombre: 'Verde',    hex: '#2ECC71' },
    { nombre: 'Amarillo', hex: '#FFD600' },
    { nombre: 'Naranja',  hex: '#F39C12' },
    { nombre: 'Morado',   hex: '#9B59B6' },
    { nombre: 'Rosa',     hex: '#FF6B9D' },
    { nombre: 'Beige',    hex: '#D4B896' },
    { nombre: 'Café',     hex: '#6D4C41' },
    { nombre: 'Khaki',    hex: '#B8A36A' },
    { nombre: 'Tie-dye',  hex: 'linear-gradient(135deg,#ff6b6b,#4ecdc4,#ffe66d)' }
  ];

  var _fotoBase64   = null;
  var _fotoEliminar = false;
  var _colorActual  = null; /* nombre del color seleccionado en el modal */

  /* ══════════════════════════════════════════
     RENDER PRINCIPAL
  ══════════════════════════════════════════ */
  function render() { filtrar(); }

  function filtrar() {
    var q      = (document.getElementById('inv-search') ? document.getElementById('inv-search').value : '').toLowerCase();
    var cat    = document.getElementById('inv-filter-cat') ? document.getElementById('inv-filter-cat').value : '';
    var estado = document.getElementById('inv-filter-estado') ? document.getElementById('inv-filter-estado').value : '';

    var data  = DB.getDatos();
    var items = (data.inventario || []).slice();

    if (q)   items = items.filter(function(i){ return i.nombre.toLowerCase().indexOf(q) > -1 || (i.descripcion||'').toLowerCase().indexOf(q) > -1; });
    if (cat) items = items.filter(function(i){ return i.categoria === cat; });
    if (estado === 'disponible') items = items.filter(function(i){ return _total(i) > 0; });
    if (estado === 'agotado')    items = items.filter(function(i){ return _total(i) === 0; });
    if (estado === 'bajo')       items = items.filter(function(i){ var t = _total(i); return t > 0 && t <= 3; });

    var lista = document.getElementById('inventario-lista');
    if (!lista) return;

    if (!items.length) {
      lista.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' +
          '<div class="empty-state-icon">🧢</div>' +
          '<div class="empty-state-title">Sin prendas</div>' +
          '<div class="empty-state-sub">Toca "+ Prenda" para agregar la primera</div>' +
        '</div>';
      return;
    }

    lista.innerHTML = items.map(function(item){ return _cardHTML(item); }).join('');
  }

  function _colorHex(nombre) {
    if (!nombre) return null;
    var c = COLORES.find(function(x){ return x.nombre === nombre; });
    return c ? c.hex : null;
  }

  function _cardHTML(item) {
    var total    = _total(item);
    var badgeCls = total === 0 ? 'stock-agotado-badge' : total <= 3 ? 'stock-bajo-badge' : 'stock-ok-badge';
    var badgeTxt = total === 0 ? 'Agotado' : total <= 3 ? 'Bajo (' + total + ')' : total + ' uds';

    /* chips de talla */
    var tallasH = '';
    var tallaEntries = Object.entries(item.tallas || {});
    if (tallaEntries.length) {
      tallasH = tallaEntries.map(function(e){
        var t = e[0], q = e[1];
        var cls = q === 0 ? 'stock-agotado' : q <= 2 ? 'stock-bajo' : 'stock-ok';
        return '<span class="talla-chip ' + cls + '">' + t + (q > 0 ? ' ×' + q : '') + '</span>';
      }).join('');
    } else {
      tallasH = '<span class="talla-chip">Sin tallas</span>';
    }

    /* imagen */
    var imgH = item.foto
      ? '<img class="inv-foto" src="' + item.foto + '" alt="' + item.nombre + '" />'
      : '<div class="inv-foto-placeholder">🧢</div>';

    /* swatch de color */
    var hex = _colorHex(item.color);
    var colorDot = item.color
      ? '<span class="color-dot" style="background:' + (hex || '#888') + '" title="' + item.color + '"></span>'
      : '';

    /* costo: mostrar en COP siempre */
    var costoCOP = item.costoCOP || item.costo || 0;

    return (
      '<div class="inv-card" onclick="Inventario.abrirModal(\'' + item.id + '\')">' +
        imgH +
        '<div class="inv-card-body">' +
          '<div class="inv-card-top">' +
            '<span class="inv-nombre">' + item.nombre + '</span>' +
            '<span class="inv-cat">' + (item.categoria || 'Otro') + '</span>' +
          '</div>' +
          (item.color ? '<div class="inv-color-row">' + colorDot + '<span class="inv-color-name">' + item.color + '</span></div>' : '') +
          '<div class="inv-tallas">' + tallasH + '</div>' +
          '<div class="inv-precios">' +
            '<span class="inv-costo">' + _fmt(costoCOP) + ' costo</span>' +
            '<span class="inv-precio">' + _fmt(item.precio) + '</span>' +
          '</div>' +
          '<span class="inv-stock-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  /* ══════════════════════════════════════════
     MODAL NUEVA / EDITAR PRENDA
  ══════════════════════════════════════════ */
  function abrirModal(itemId) {
    itemId = itemId || null;
    _fotoBase64   = null;
    _fotoEliminar = false;

    var data   = DB.getDatos();
    var item   = itemId ? (data.inventario || []).find(function(i){ return i.id === itemId; }) : null;
    var tallas = (data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL'];

    _colorActual = item ? (item.color || null) : null;

    /* ── valores de moneda/TRM ── */
    var moneda   = item && item.moneda   ? item.moneda   : 'COP';
    var trm      = item && item.trm      ? item.trm      : 4000;
    var costoUSD = item && item.costoUSD ? item.costoUSD : 0;
    var costoCOP = item && item.costoCOP ? item.costoCOP : (item && item.costo ? item.costo : 0);

    /* ── tallas ── */
    var tallasH = tallas.map(function(t){
      var qty = (item && item.tallas && item.tallas[t] !== undefined) ? item.tallas[t] : 0;
      return (
        '<div class="talla-row">' +
          '<label>' + t + '</label>' +
          '<input type="number" id="talla-' + t + '" value="' + qty + '" min="0" />' +
        '</div>'
      );
    }).join('');

    /* ── colores (grid de swatches) ── */
    var coloresH = COLORES.map(function(c){
      var isActive = _colorActual === c.nombre;
      var bg = c.hex.startsWith('linear') ? c.hex : c.hex;
      return (
        '<button type="button" class="color-swatch' + (isActive ? ' color-swatch-active' : '') + '" ' +
          'style="background:' + bg + '" ' +
          'title="' + c.nombre + '" ' +
          'onclick="Inventario._selColor(\'' + c.nombre.replace(/'/g, "\\'") + '\',this)">' +
          (isActive ? '<span class="swatch-check">✓</span>' : '') +
        '</button>'
      );
    }).join('');

    /* ── foto ── */
    var fotoSrc = item && item.foto ? item.foto : '';

    Modal.abrir(item ? 'Editar prenda' : 'Nueva prenda',

      /* — FOTO — */
      '<div class="form-group">' +
        '<label>Foto de la prenda</label>' +
        '<label class="foto-upload-wrap" for="inv-foto-input">' +
          '<img id="inv-foto-preview" src="' + fotoSrc + '" style="' + (fotoSrc ? '' : 'display:none') + '" />' +
          '<div class="foto-upload-label" id="foto-label"' + (fotoSrc ? ' style="display:none"' : '') + '>' +
            '<span style="font-size:32px">📷</span>' +
            '<span style="font-size:13px;font-weight:700">Toca para agregar foto</span>' +
            '<span style="font-size:11px;color:var(--text-muted)">JPG, PNG · se comprime auto</span>' +
          '</div>' +
          '<input type="file" id="inv-foto-input" accept="image/*" capture="environment" style="display:none" onchange="Inventario._onFoto(this)" />' +
        '</label>' +
        (fotoSrc ? '<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="Inventario._quitarFoto()">✕ Quitar foto</button>' : '') +
      '</div>' +

      /* — NOMBRE — */
      '<div class="form-group">' +
        '<label>Nombre de la prenda</label>' +
        '<input type="text" id="inv-nombre" value="' + (item ? item.nombre || '' : '') + '" placeholder="Ej: Hoodie Unbroken Classic" />' +
      '</div>' +

      /* — CAT + PRECIO — */
      '<div class="form-row">' +
        '<div class="form-group"><label>Categoría</label><select id="inv-cat">' +
          ['Camiseta','Hoodie','Pantalón','Short','Chaqueta','Accesorio','Otro'].map(function(c){
            return '<option value="' + c + '"' + (item && item.categoria === c ? ' selected' : '') + '>' + c + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="form-group"><label>Precio de venta ($)</label>' +
          '<input type="number" id="inv-precio" value="' + (item ? item.precio || '' : '') + '" placeholder="0" min="0" /></div>' +
      '</div>' +

      /* — MONEDA + TRM — */
      '<div class="form-group">' +
        '<label>Costo unitario</label>' +
        '<div class="form-row" style="margin-bottom:8px">' +
          '<div class="form-group"><label style="font-size:12px;font-weight:600;margin-bottom:4px">Moneda</label>' +
            '<select id="inv-moneda" onchange="Inventario._onMonedaChange()">' +
              '<option value="COP"' + (moneda === 'COP' ? ' selected' : '') + '>Pesos COP</option>' +
              '<option value="USD"' + (moneda === 'USD' ? ' selected' : '') + '>Dólares USD</option>' +
            '</select></div>' +
          '<div class="form-group"><label style="font-size:12px;font-weight:600;margin-bottom:4px">TRM (USD → COP)</label>' +
            '<input type="number" id="inv-trm" value="' + trm + '" placeholder="4000" min="0" step="1" onchange="Inventario._onTRMChange()" /></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label style="font-size:12px;font-weight:600;margin-bottom:4px">Costo USD</label>' +
            '<input type="number" id="inv-costo-usd" value="' + costoUSD + '" placeholder="0" min="0" step="0.01" onchange="Inventario._onCostoChange()" /></div>' +
          '<div class="form-group"><label style="font-size:12px;font-weight:600;margin-bottom:4px">Costo COP</label>' +
            '<input type="number" id="inv-costo-cop" value="' + costoCOP + '" placeholder="0" min="0" step="1" onchange="Inventario._onCostoChange()" /></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">💡 Elige la moneda de compra y el sistema convierte automáticamente</div>' +
      '</div>' +

      /* — COLORES — */
      '<div class="form-group">' +
        '<label>Color</label>' +
        '<div id="color-seleccionado" class="color-seleccionado-label">' +
          (_colorActual
            ? '<span class="color-dot" style="background:' + (_colorHex(_colorActual) || '#888') + '"></span><span>' + _colorActual + '</span>'
            : '<span style="color:var(--text-muted)">Sin color seleccionado</span>') +
        '</div>' +
        '<div class="colores-grid">' + coloresH + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;align-items:center">' +
          '<input type="text" id="inv-color-custom" placeholder="O escribe un color..." ' +
            'value="' + (item && item.color && !COLORES.find(function(c){return c.nombre===item.color;}) ? item.color : '') + '" ' +
            'oninput="Inventario._onColorCustom(this.value)" style="flex:1" />' +
        '</div>' +
      '</div>' +

      /* — TALLAS — */
      '<div class="form-group">' +
        '<label>Stock por talla</label>' +
        '<div class="tallas-grid">' + tallasH + '</div>' +
      '</div>' +

      /* — DESCRIPCIÓN — */
      '<div class="form-group">' +
        '<label>Descripción (opcional)</label>' +
        '<textarea id="inv-desc" placeholder="Material, referencia, notas...">' + (item ? item.descripcion || '' : '') + '</textarea>' +
      '</div>' +

      /* — ACCIONES — */
      '<div class="form-actions">' +
        (item ? '<button class="btn btn-danger" onclick="Inventario.eliminar(\'' + item.id + '\')">Eliminar</button>' : '') +
        '<button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="Inventario.guardar(\'' + (itemId || '') + '\')">Guardar</button>' +
      '</div>'
    );

    /* establecer moneda inicial (habilita/deshabilita campos) */
    _onMonedaChange();
  }

  /* ══════════════════════════════════════════
     CONVERSIÓN USD/COP
  ══════════════════════════════════════════ */
  function _onMonedaChange() {
    var moneda   = (document.getElementById('inv-moneda') || {}).value || 'COP';
    var trm      = parseFloat((document.getElementById('inv-trm') || {}).value || '4000') || 4000;
    var costoUSD = parseFloat((document.getElementById('inv-costo-usd') || {}).value || '0') || 0;
    var costoCOP = parseFloat((document.getElementById('inv-costo-cop') || {}).value || '0') || 0;

    var usdInput = document.getElementById('inv-costo-usd');
    var copInput = document.getElementById('inv-costo-cop');

    if (moneda === 'USD') {
      /* modo USD: el usuario edita USD, COP se calcula */
      if (usdInput) usdInput.disabled = false;
      if (copInput) { copInput.disabled = true; copInput.value = Math.round(costoUSD * trm); }
    } else {
      /* modo COP: el usuario edita COP, USD se calcula */
      if (usdInput) { usdInput.disabled = true; usdInput.value = (costoCOP / trm).toFixed(2); }
      if (copInput) copInput.disabled = false;
    }
  }

  function _onCostoChange() {
    var moneda   = (document.getElementById('inv-moneda') || {}).value || 'COP';
    var trm      = parseFloat((document.getElementById('inv-trm') || {}).value || '4000') || 4000;
    var usdInput = document.getElementById('inv-costo-usd');
    var copInput = document.getElementById('inv-costo-cop');

    if (moneda === 'USD') {
      var costoUSD = parseFloat((usdInput || {}).value || '0') || 0;
      if (copInput) copInput.value = Math.round(costoUSD * trm);
    } else {
      var costoCOP = parseFloat((copInput || {}).value || '0') || 0;
      if (usdInput) usdInput.value = (costoCOP / trm).toFixed(2);
    }
  }

  function _onTRMChange() {
    _onCostoChange();
  }

  /* ══════════════════════════════════════════
     COLOR, FOTO
  ══════════════════════════════════════════ */
  function _selColor(nombre, btn) {
    _colorActual = nombre;
    /* limpiar custom input */
    var ci = document.getElementById('inv-color-custom');
    if (ci) ci.value = '';
    /* marcar activo */
    document.querySelectorAll('.color-swatch').forEach(function(b){
      b.classList.remove('color-swatch-active');
      b.innerHTML = '';
    });
    if (btn) {
      btn.classList.add('color-swatch-active');
      btn.innerHTML = '<span class="swatch-check">✓</span>';
    }
    /* actualizar label */
    var hex = _colorHex(nombre);
    var label = document.getElementById('color-seleccionado');
    if (label) {
      label.innerHTML =
        '<span class="color-dot" style="background:' + (hex || '#888') + '"></span>' +
        '<span>' + nombre + '</span>';
    }
  }

  function _onColorCustom(val) {
    if (!val.trim()) return;
    _colorActual = val.trim();
    /* deseleccionar swatches */
    document.querySelectorAll('.color-swatch').forEach(function(b){
      b.classList.remove('color-swatch-active');
      b.innerHTML = '';
    });
    var label = document.getElementById('color-seleccionado');
    if (label) {
      label.innerHTML = '<span>' + val.trim() + '</span>';
    }
  }

  function _onFoto(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var MAX = 600;
        var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        _fotoBase64 = canvas.toDataURL('image/jpeg', 0.78);
        var prev  = document.getElementById('inv-foto-preview');
        var label = document.getElementById('foto-label');
        if (prev)  { prev.src = _fotoBase64; prev.style.display = 'block'; }
        if (label) label.style.display = 'none';
        Toast.show('Foto cargada ✓', 'ok');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function _quitarFoto() {
    _fotoBase64   = null;
    _fotoEliminar = true;
    var prev  = document.getElementById('inv-foto-preview');
    var label = document.getElementById('foto-label');
    if (prev)  { prev.src = ''; prev.style.display = 'none'; }
    if (label) label.style.display = 'flex';
    Toast.show('Foto eliminada', 'ok');
  }

  /* ══════════════════════════════════════════
     GUARDAR PRENDA
  ══════════════════════════════════════════ */
  async function guardar(itemId) {
    var nombre = (document.getElementById('inv-nombre') || {}).value || '';
    nombre = nombre.trim();
    var cat    = (document.getElementById('inv-cat') || {}).value || 'Otro';
    var precio = parseFloat((document.getElementById('inv-precio') || {}).value || '0') || 0;
    var desc   = ((document.getElementById('inv-desc') || {}).value || '').trim();

    /* color: swatch seleccionado o custom input */
    var colorCustom = ((document.getElementById('inv-color-custom') || {}).value || '').trim();
    var color = colorCustom || _colorActual || '';

    /* moneda + TRM + costos */
    var moneda   = (document.getElementById('inv-moneda') || {}).value || 'COP';
    var trm      = parseFloat((document.getElementById('inv-trm') || {}).value || '4000') || 4000;
    var costoUSD = parseFloat((document.getElementById('inv-costo-usd') || {}).value || '0') || 0;
    var costoCOP = parseFloat((document.getElementById('inv-costo-cop') || {}).value || '0') || 0;

    if (!nombre) { Toast.show('El nombre es obligatorio', 'error'); return; }

    var data   = DB.getDatos();
    var tallas = (data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL'];
    var tallasObj = {};
    tallas.forEach(function(t) {
      var el = document.getElementById('talla-' + t);
      tallasObj[t] = el ? (parseInt(el.value) || 0) : 0;
    });

    /* foto */
    var foto = null;
    if (_fotoBase64) {
      foto = _fotoBase64;
    } else if (!_fotoEliminar && itemId) {
      var prev = (data.inventario || []).find(function(i){ return i.id === itemId; });
      foto = prev ? (prev.foto || null) : null;
    }

    var ahora = new Date().toISOString();

    if (itemId) {
      var idx = (data.inventario || []).findIndex(function(i){ return i.id === itemId; });
      if (idx === -1) return;
      data.inventario[idx] = Object.assign({}, data.inventario[idx], {
        nombre: nombre, categoria: cat, color: color,
        precio: precio, descripcion: desc,
        moneda: moneda, trm: trm, costoUSD: costoUSD, costoCOP: costoCOP,
        costo: costoCOP, /* compatibilidad con código existente */
        tallas: tallasObj, foto: foto, actualizadoEn: ahora
      });
    } else {
      data.inventario = data.inventario || [];
      data.inventario.push({
        id: _uid(), nombre: nombre, categoria: cat, color: color,
        precio: precio, descripcion: desc,
        moneda: moneda, trm: trm, costoUSD: costoUSD, costoCOP: costoCOP,
        costo: costoCOP, /* compatibilidad */
        tallas: tallasObj, foto: foto,
        creadoEn: ahora, actualizadoEn: ahora
      });
    }

    _fotoBase64 = null; _fotoEliminar = false; _colorActual = null;

    await DB.guardarYPush(data);
    Modal.cerrar();
    render();
    Toast.show(itemId ? 'Prenda actualizada ✓' : 'Prenda agregada ✓', 'ok');
  }

  async function eliminar(itemId) {
    if (!confirm('¿Eliminar esta prenda del inventario?')) return;
    var data = DB.getDatos();
    data.inventario = (data.inventario || []).filter(function(i){ return i.id !== itemId; });
    await DB.guardarYPush(data);
    Modal.cerrar();
    render();
    Toast.show('Prenda eliminada', 'ok');
  }

  function descontarStock(itemId, talla, cantidad) {
    cantidad = cantidad || 1;
    var data = DB.getDatos();
    var item = (data.inventario || []).find(function(i){ return i.id === itemId; });
    if (!item || !item.tallas) return false;
    var actual = item.tallas[talla] || 0;
    if (actual < cantidad) return false;
    item.tallas[talla] = actual - cantidad;
    item.actualizadoEn = new Date().toISOString();
    DB.setDatos(data);
    return true;
  }

  /* tallas en config */
  async function guardarTallas() {
    var raw    = (document.getElementById('cfg-tallas') || {}).value || '';
    var tallas = raw.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    if (!tallas.length) { Toast.show('Ingresa al menos una talla', 'error'); return; }
    var data = DB.getDatos();
    data.config = data.config || {};
    data.config.tallas = tallas;
    await DB.guardarYPush(data);
    Toast.show('Tallas guardadas ✓', 'ok');
  }

  function cargarTallasEnUI() {
    var data = DB.getDatos();
    var inp  = document.getElementById('cfg-tallas');
    if (inp) inp.value = ((data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL']).join(',');
  }

  /* stock bajo para dashboard */
  function renderStockBajo() {
    var lista = document.getElementById('dashboard-stock-bajo');
    if (!lista) return;
    var data  = DB.getDatos();
    var bajos = (data.inventario || []).filter(function(i){ return _total(i) <= 3; }).slice(0, 5);
    if (!bajos.length) {
      lista.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">Stock suficiente en todo el inventario 👍</div>';
      return;
    }
    lista.innerHTML = bajos.map(function(i) {
      var t   = _total(i);
      var cls = t === 0 ? 'stock-agotado-badge' : 'stock-bajo-badge';
      var txt = t === 0 ? 'Agotado' : t + ' uds';
      var hex = _colorHex(i.color);
      return (
        '<div class="item-row" onclick="Inventario.abrirModal(\'' + i.id + '\')">' +
          (i.foto
            ? '<img src="' + i.foto + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0" />'
            : '<div style="width:40px;height:40px;border-radius:8px;background:var(--bg-card2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🧢</div>') +
          '<div class="item-row-info">' +
            '<div class="item-row-title">' + i.nombre + '</div>' +
            '<div class="item-row-sub" style="display:flex;align-items:center;gap:5px">' +
              (i.color ? '<span class="color-dot-sm" style="background:' + (hex||'#888') + '"></span>' + i.color : i.categoria || '') +
            '</div>' +
          '</div>' +
          '<span class="inv-stock-badge ' + cls + '">' + txt + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* utils */
  function _total(item) {
    return Object.values(item.tallas || {}).reduce(function(a, b){ return a + b; }, 0);
  }
  function getStockTotal(item) { return _total(item); }
  function _fmt(n) {
    if (n === null || n === undefined) return '$0';
    return '$' + Number(n).toLocaleString('es-CO');
  }
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    render: render,
    filtrar: filtrar,
    abrirModal: abrirModal,
    guardar: guardar,
    eliminar: eliminar,
    guardarTallas: guardarTallas,
    cargarTallasEnUI: cargarTallasEnUI,
    renderStockBajo: renderStockBajo,
    getStockTotal: getStockTotal,
    descontarStock: descontarStock,
    _onFoto: _onFoto,
    _quitarFoto: _quitarFoto,
    _selColor: _selColor,
    _onColorCustom: _onColorCustom,
    _onMonedaChange: _onMonedaChange,
    _onCostoChange: _onCostoChange,
    _onTRMChange: _onTRMChange
  };

}());
