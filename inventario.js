/* ═══════════════════════════════════════════════════
   UNBROKEN. — inventario.js
   Prendas con foto, tallas, stock, costo y precio
═══════════════════════════════════════════════════ */

var Inventario = (function() {

  /* ── render principal ── */
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
      lista.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
        '<div class="empty-state-icon">🧢</div>' +
        '<div class="empty-state-title">Sin prendas</div>' +
        '<div class="empty-state-sub">Agrega tu primera prenda al inventario</div>' +
        '</div>';
      return;
    }

    lista.innerHTML = items.map(function(item){ return _cardHTML(item); }).join('');
  }

  function _cardHTML(item) {
    var total     = _total(item);
    var badgeCls  = total === 0 ? 'stock-agotado-badge' : total <= 3 ? 'stock-bajo-badge' : 'stock-ok-badge';
    var badgeTxt  = total === 0 ? 'Agotado' : total <= 3 ? 'Stock bajo (' + total + ')' : total + ' uds';

    var tallas    = Object.entries(item.tallas || {});
    var tallasH   = tallas.length
      ? tallas.map(function(e){
          var t = e[0], q = e[1];
          var cls = q === 0 ? 'stock-agotado' : q <= 2 ? 'stock-bajo' : 'stock-ok';
          return '<span class="talla-chip ' + cls + '">' + t + (q > 0 ? ' ×' + q : '') + '</span>';
        }).join('')
      : '<span class="talla-chip">Sin tallas</span>';

    /* imagen o placeholder */
    var imgH = item.foto
      ? '<img class="inv-foto" src="' + item.foto + '" alt="' + item.nombre + '" loading="lazy" />'
      : '<div class="inv-foto-placeholder">🧢</div>';

    return '<div class="inv-card" onclick="Inventario.abrirModal(\'' + item.id + '\')">' +
      imgH +
      '<div class="inv-card-body">' +
        '<div class="inv-card-top">' +
          '<span class="inv-nombre">' + item.nombre + '</span>' +
          '<span class="inv-cat">' + (item.categoria || 'Otro') + '</span>' +
        '</div>' +
        '<div class="inv-tallas">' + tallasH + '</div>' +
        '<div class="inv-precios">' +
          '<span class="inv-costo">Costo: ' + _fmt(item.costo) + '</span>' +
          '<span class="inv-precio">' + _fmt(item.precio) + '</span>' +
        '</div>' +
        '<span class="inv-stock-badge ' + badgeCls + '">' + badgeTxt + '</span>' +
      '</div>' +
    '</div>';
  }

  /* ── abrir modal ── */
  function abrirModal(itemId) {
    itemId = itemId || null;
    var data   = DB.getDatos();
    var item   = itemId ? (data.inventario || []).find(function(i){ return i.id === itemId; }) : null;
    var tallas = (data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL'];

    var tallasH = tallas.map(function(t){
      var qty = (item && item.tallas && item.tallas[t] !== undefined) ? item.tallas[t] : 0;
      return '<div class="talla-row"><label>' + t + '</label>' +
        '<input type="number" id="talla-' + t + '" value="' + qty + '" min="0" /></div>';
    }).join('');

    /* foto actual */
    var fotoPreviewStyle = (item && item.foto) ? 'display:block' : 'display:none';
    var fotoSrc          = (item && item.foto) ? item.foto : '';

    Modal.abrir(item ? 'Editar prenda' : 'Nueva prenda',
      /* Foto */
      '<div class="form-group"><label>Foto de la prenda</label>' +
        '<div class="foto-upload-wrap" onclick="document.getElementById(\'inv-foto-input\').click()">' +
          '<img id="inv-foto-preview" src="' + fotoSrc + '" style="' + fotoPreviewStyle + '" />' +
          '<div class="foto-upload-label" id="foto-label" style="' + (fotoSrc ? 'display:none' : '') + '">' +
            '<span class="icon">📷</span>' +
            '<span>Toca para agregar foto</span>' +
          '</div>' +
          '<input type="file" id="inv-foto-input" accept="image/*" onchange="Inventario._onFoto(this)" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer" />' +
        '</div>' +
        (fotoSrc ? '<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="Inventario._quitarFoto()">✕ Quitar foto</button>' : '') +
      '</div>' +

      /* Nombre */
      '<div class="form-group"><label>Nombre de la prenda</label>' +
        '<input type="text" id="inv-nombre" value="' + (item ? item.nombre || '' : '') + '" placeholder="Ej: Hoodie Unbroken Classic" /></div>' +

      /* Cat + Color */
      '<div class="form-row">' +
        '<div class="form-group"><label>Categoría</label><select id="inv-cat">' +
          ['Camiseta','Hoodie','Pantalón','Short','Chaqueta','Accesorio','Otro'].map(function(c){
            return '<option value="' + c + '"' + (item && item.categoria === c ? ' selected' : '') + '>' + c + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="form-group"><label>Color</label>' +
          '<input type="text" id="inv-color" value="' + (item ? item.color || '' : '') + '" placeholder="Negro, Blanco..." /></div>' +
      '</div>' +

      /* Costo + Precio */
      '<div class="form-row">' +
        '<div class="form-group"><label>Costo unitario ($)</label>' +
          '<input type="number" id="inv-costo" value="' + (item ? item.costo || '' : '') + '" placeholder="0" min="0" /></div>' +
        '<div class="form-group"><label>Precio de venta ($)</label>' +
          '<input type="number" id="inv-precio" value="' + (item ? item.precio || '' : '') + '" placeholder="0" min="0" /></div>' +
      '</div>' +

      /* Descripción */
      '<div class="form-group"><label>Descripción (opcional)</label>' +
        '<textarea id="inv-desc" placeholder="Notas sobre la prenda...">' + (item ? item.descripcion || '' : '') + '</textarea></div>' +

      /* Tallas */
      '<div class="form-group"><label>Stock por talla</label>' +
        '<div class="tallas-grid">' + tallasH + '</div></div>' +

      /* Acciones */
      '<div class="form-actions">' +
        (item ? '<button class="btn btn-danger" onclick="Inventario.eliminar(\'' + item.id + '\')">Eliminar</button>' : '') +
        '<button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="Inventario.guardar(\'' + (itemId || '') + '\')">Guardar</button>' +
      '</div>'
    );
  }

  /* ── manejo de foto ── */
  var _fotoBase64 = null; /* foto nueva seleccionada */
  var _fotoEliminar = false;

  function _onFoto(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    /* comprimir a máx 400px y calidad 70% para no hacer el JSON enorme */
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var MAX = 400;
        var ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        _fotoBase64 = canvas.toDataURL('image/jpeg', 0.72);
        /* mostrar preview */
        var prev = document.getElementById('inv-foto-preview');
        var lbl  = document.getElementById('foto-label');
        if (prev) { prev.src = _fotoBase64; prev.style.display = 'block'; }
        if (lbl)  lbl.style.display = 'none';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function _quitarFoto() {
    _fotoBase64 = null;
    _fotoEliminar = true;
    var prev = document.getElementById('inv-foto-preview');
    var lbl  = document.getElementById('foto-label');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    if (lbl)  lbl.style.display = 'flex';
  }

  /* ── guardar prenda ── */
  async function guardar(itemId) {
    var nombre = document.getElementById('inv-nombre') ? document.getElementById('inv-nombre').value.trim() : '';
    var cat    = document.getElementById('inv-cat') ? document.getElementById('inv-cat').value : 'Otro';
    var color  = document.getElementById('inv-color') ? document.getElementById('inv-color').value.trim() : '';
    var costo  = parseFloat(document.getElementById('inv-costo') ? document.getElementById('inv-costo').value : '0') || 0;
    var precio = parseFloat(document.getElementById('inv-precio') ? document.getElementById('inv-precio').value : '0') || 0;
    var desc   = document.getElementById('inv-desc') ? document.getElementById('inv-desc').value.trim() : '';

    if (!nombre) { Toast.show('El nombre es obligatorio', 'error'); return; }

    var data   = DB.getDatos();
    var tallas = (data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL'];
    var tallasObj = {};
    tallas.forEach(function(t) {
      var el = document.getElementById('talla-' + t);
      tallasObj[t] = el ? (parseInt(el.value) || 0) : 0;
    });

    /* foto: nueva, eliminada o mantener la anterior */
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
        costo: costo, precio: precio, descripcion: desc,
        tallas: tallasObj, foto: foto, actualizadoEn: ahora
      });
    } else {
      data.inventario = data.inventario || [];
      data.inventario.push({
        id: _uid(), nombre: nombre, categoria: cat, color: color,
        costo: costo, precio: precio, descripcion: desc,
        tallas: tallasObj, foto: foto,
        creadoEn: ahora, actualizadoEn: ahora
      });
    }

    _fotoBase64   = null;
    _fotoEliminar = false;

    await DB.guardarYPush(data);
    Modal.cerrar();
    render();
    Toast.show(itemId ? 'Prenda actualizada' : 'Prenda agregada ✓', 'ok');
  }

  async function eliminar(itemId) {
    if (!confirm('¿Eliminar esta prenda?')) return;
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
    if (!item) return false;
    if (!item.tallas) item.tallas = {};
    var actual = item.tallas[talla] || 0;
    if (actual < cantidad) return false;
    item.tallas[talla] = actual - cantidad;
    item.actualizadoEn = new Date().toISOString();
    DB.setDatos(data);
    return true;
  }

  /* ── tallas en config ── */
  async function guardarTallas() {
    var raw    = document.getElementById('cfg-tallas') ? document.getElementById('cfg-tallas').value : '';
    var tallas = raw.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    if (!tallas.length) { Toast.show('Ingresa al menos una talla', 'error'); return; }
    var data = DB.getDatos();
    data.config = data.config || {};
    data.config.tallas = tallas;
    await DB.guardarYPush(data);
    Toast.show('Tallas guardadas', 'ok');
  }

  function cargarTallasEnUI() {
    var data = DB.getDatos();
    var inp  = document.getElementById('cfg-tallas');
    if (inp) inp.value = ((data.config && data.config.tallas) || ['XS','S','M','L','XL','XXL']).join(',');
  }

  /* ── stock bajo para dashboard ── */
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
      return '<div class="item-row" onclick="Inventario.abrirModal(\'' + i.id + '\')">' +
        (i.foto ? '<img src="' + i.foto + '" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0" />' : '') +
        '<div class="item-row-info"><div class="item-row-title">' + i.nombre + '</div>' +
        '<div class="item-row-sub">' + (i.categoria||'') + (i.color ? ' · ' + i.color : '') + '</div></div>' +
        '<span class="inv-stock-badge ' + cls + '">' + txt + '</span>' +
      '</div>';
    }).join('');
  }

  /* ── utils ── */
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
    _quitarFoto: _quitarFoto
  };

}());
