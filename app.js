/* ═══════════════════════════════════════════════════
   UNBROKEN. — app.js  (núcleo unificado)
   Nav · Modal · Toast · Dashboard
═══════════════════════════════════════════════════ */

/* ── utilidad global ── */
function _fmt(n) {
  if (n === undefined || n === null) return '$0';
  return '$' + Number(n).toLocaleString('es-CO');
}
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function _set(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
function _get(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
var Toast = {
  _t: null,
  show: function(msg, tipo) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (tipo ? ' toast-' + tipo : '');
    el.classList.remove('hidden');
    clearTimeout(this._t);
    this._t = setTimeout(function(){ el.classList.add('hidden'); }, 3500);
  }
};

/* ══════════════════════════════════════════
   MODAL
══════════════════════════════════════════ */
var Modal = {
  abrir: function(titulo, html) {
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },
  cerrar: function(e) {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }
};

/* ══════════════════════════════════════════
   NAVEGACIÓN
══════════════════════════════════════════ */
var Nav = {
  _actual: 'dashboard',
  go: function(view) {
    /* ocultar todas quitando clase active */
    document.querySelectorAll('.view').forEach(function(v) {
      v.classList.remove('active');
    });
    /* mostrar la pedida agregando clase active */
    var target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');

    /* título */
    var titles = {dashboard:'Inicio',inventario:'Inventario',ventas:'Ventas',
                  costos:'Costos',usuarios:'Usuarios',config:'Configuración'};
    _set('topbar-title', titles[view] || view);

    /* nav activo */
    document.querySelectorAll('.nav-btn').forEach(function(b){
      b.classList.toggle('active', b.dataset.view === view);
    });

    Nav._actual = view;
    Nav._enter(view);
  },
  _enter: function(view) {
    if (view === 'dashboard')  { Dashboard.render();           return; }
    if (view === 'inventario') { Inventario.render();          return; }
    if (view === 'ventas')     { Ventas.render();              return; }
    if (view === 'costos')     { Costos.render();              return; }
    if (view === 'usuarios')   { Auth.renderUsuarios();        return; }
    if (view === 'config')     { Config.render();              return; }
  },
  refresh: function() { Nav._enter(Nav._actual); }
};

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
var Dashboard = {
  render: function() {
    var data = DB.getDatos();
    var mes  = new Date().toISOString().slice(0,7);
    var ventas = (data.ventas || []).filter(function(v){ return v.mes === mes; });

    var ingresos = 0, costos = 0;
    ventas.forEach(function(v){ ingresos += v.total||0; costos += v.costoTotal||0; });
    var prendas = (data.inventario||[]).reduce(function(a,i){
      return a + Object.values(i.tallas||{}).reduce(function(s,q){return s+q;},0);
    },0);

    _set('kpi-ingresos', _fmt(ingresos));
    _set('kpi-costos',   _fmt(costos));
    _set('kpi-ganancia', _fmt(ingresos - costos));
    _set('kpi-prendas',  prendas);

    var g = document.getElementById('kpi-ganancia');
    if (g) g.style.color = ingresos - costos >= 0 ? '' : 'var(--red)';

    /* últimas ventas */
    var listaEl = document.getElementById('dashboard-ventas-recientes');
    if (listaEl) {
      var ult = ventas.slice().sort(function(a,b){return new Date(b.fecha)-new Date(a.fecha);}).slice(0,5);
      if (!ult.length) {
        listaEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">Sin ventas este mes aún</div>';
      } else {
        listaEl.innerHTML = ult.map(function(v){
          var gan = (v.total||0)-(v.costoTotal||0);
          var fecha = new Date(v.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
          return '<div class="item-row" onclick="Ventas.verDetalle(\''+v.id+'\')">' +
            '<div class="item-row-info"><div class="item-row-title">'+(v.cliente||'Venta directa')+'</div>' +
            '<div class="item-row-sub">'+fecha+' · '+(v.canal==='online'?'Online':'Físico')+'</div></div>' +
            '<div style="text-align:right"><div class="item-row-valor">'+_fmt(v.total)+'</div>' +
            '<div style="font-size:11px;color:var(--green)">+'+_fmt(gan)+'</div></div></div>';
        }).join('');
      }
    }

    /* stock bajo */
    var stockEl = document.getElementById('dashboard-stock-bajo');
    if (stockEl) {
      var bajos = (data.inventario||[]).filter(function(i){
        var t = Object.values(i.tallas||{}).reduce(function(a,b){return a+b;},0);
        return t <= 3;
      }).slice(0,5);
      if (!bajos.length) {
        stockEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">Stock suficiente en todo el inventario 👍</div>';
      } else {
        stockEl.innerHTML = bajos.map(function(i){
          var t = Object.values(i.tallas||{}).reduce(function(a,b){return a+b;},0);
          var cls = t===0?'stock-agotado-badge':'stock-bajo-badge';
          var txt = t===0?'Agotado':t+' uds';
          return '<div class="item-row" onclick="Inventario.abrirModal(\''+i.id+'\')">' +
            '<div class="item-row-info"><div class="item-row-title">'+i.nombre+'</div>' +
            '<div class="item-row-sub">'+(i.categoria||'')+(i.color?' · '+i.color:'')+'</div></div>' +
            '<span class="inv-stock-badge '+cls+'">'+txt+'</span></div>';
        }).join('');
      }
    }
  }
};

/* ══════════════════════════════════════════
   VENTAS
══════════════════════════════════════════ */
var Ventas = {
  render: function() {
    /* poblar select de meses */
    var sel = document.getElementById('ventas-filter-mes');
    if (sel) {
      var data = DB.getDatos();
      var mesAct = new Date().toISOString().slice(0,7);
      var meses = (data.ventas||[]).map(function(v){return v.mes;});
      meses = meses.filter(function(v,i,a){return a.indexOf(v)===i;}).sort().reverse();
      if (meses.indexOf(mesAct) === -1) meses.unshift(mesAct);
      var cur = sel.value || mesAct;
      sel.innerHTML = meses.map(function(m){
        var parts = m.split('-');
        var nombres=['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return '<option value="'+m+'"'+(m===cur?' selected':'')+'>'+nombres[parseInt(parts[1])]+' '+parts[0]+'</option>';
      }).join('');
    }
    Ventas.filtrar();
  },

  filtrar: function() {
    var mes  = _get('ventas-filter-mes') || new Date().toISOString().slice(0,7);
    var data = DB.getDatos();
    var ventas = (data.ventas||[]).filter(function(v){return v.mes===mes;});

    var ingresos=0, costosT=0;
    ventas.forEach(function(v){ingresos+=v.total||0; costosT+=v.costoTotal||0;});
    var gan = ingresos - costosT;
    var margen = ingresos>0 ? Math.round(gan/ingresos*100) : 0;

    _set('res-ingresos', _fmt(ingresos));
    _set('res-costos',   _fmt(costosT));
    _set('res-ganancia', _fmt(gan));
    _set('res-margen',   margen+'%');
    var ganEl = document.getElementById('res-ganancia');
    if (ganEl) ganEl.style.color = gan>=0 ? 'var(--green)' : 'var(--red)';

    var lista = document.getElementById('ventas-lista');
    if (!lista) return;
    if (!ventas.length) {
      lista.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Sin ventas este mes</div><div class="empty-state-sub">Registra tu primera venta</div></div>';
      return;
    }
    lista.innerHTML = ventas.slice().sort(function(a,b){return new Date(b.fecha)-new Date(a.fecha);})
      .map(function(v){ return Ventas._card(v); }).join('');
  },

  _card: function(v) {
    var gan = (v.total||0)-(v.costoTotal||0);
    var fecha = new Date(v.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short'});
    var canal = v.canal==='online'
      ? '<span class="venta-canal canal-online">Online</span>'
      : '<span class="venta-canal canal-fisico">Físico</span>';
    var items = (v.items||[]).map(function(i){return i.nombre+(i.talla?' ('+i.talla+')':'');}).join(', ');
    return '<div class="venta-card" onclick="Ventas.verDetalle(\''+v.id+'\')">' +
      '<div class="venta-top">' +
        '<div><div class="venta-nombre">'+(v.cliente||'Venta directa')+'</div>' +
        '<div class="venta-meta"><span>'+fecha+'</span>'+canal+'<span>'+items+'</span></div></div>' +
        '<div style="text-align:right"><div class="venta-total">'+_fmt(v.total)+'</div>' +
        '<div class="venta-ganancia">+'+_fmt(gan)+'</div></div>' +
      '</div></div>';
  },

  /* ── Nueva venta ── */
  nueva: function() {
    var data = DB.getDatos();
    var inv  = data.inventario || [];
    var cats = (data.config && data.config.categoriasCosto) || ['Envío','Empaque','Publicidad','Otro'];
    var hoy  = new Date().toISOString().slice(0,10);

    Modal.abrir('Nueva venta',
      '<div class="form-row">' +
        '<div class="form-group"><label>Fecha</label><input type="date" id="v-fecha" value="'+hoy+'"/></div>' +
        '<div class="form-group"><label>Canal</label><select id="v-canal"><option value="fisico">Físico</option><option value="online">Online</option></select></div>' +
      '</div>' +
      '<div class="form-group"><label>Cliente (opcional)</label><input type="text" id="v-cliente" placeholder="Nombre del cliente"/></div>' +
      '<div class="form-group"><label>Productos</label>' +
        '<div id="v-items"></div>' +
        '<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" onclick="Ventas._addItem()">+ Agregar prenda</button>' +
      '</div>' +
      '<div class="form-group"><label>Costos adicionales</label>' +
        '<div id="v-costos">' +
          '<div class="costo-venta-row" id="cv-0"><input type="text" value="Envío" id="cc-0" style="flex:1" placeholder="Concepto"/>' +
          '<input type="number" id="cv0" value="0" min="0" style="width:90px" oninput="Ventas._calcTotal()"/>' +
          '<button class="btn btn-ghost btn-icon btn-sm" onclick="this.parentNode.remove();Ventas._calcTotal()">✕</button></div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="Ventas._addCosto()">+ Agregar costo</button>' +
      '</div>' +
      '<div class="form-group"><label>Notas</label><textarea id="v-notas" placeholder="Observaciones..."></textarea></div>' +
      '<div id="v-totales" class="totales-venta"></div>' +
      '<div class="form-actions"><button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="Ventas.guardar()">Registrar venta</button></div>'
    );
    Ventas._calcTotal();
  },

  _iIdx: 0,
  _cIdx: 1,

  _addItem: function() {
    var data = DB.getDatos();
    var inv  = data.inventario || [];
    var idx  = Ventas._iIdx++;
    var opts = inv.map(function(i){return '<option value="'+i.id+'">'+i.nombre+'</option>';}).join('');
    var div = document.createElement('div');
    div.className = 'venta-item-row';
    div.id = 'vi-'+idx;
    div.innerHTML =
      '<div style="flex:1;display:flex;flex-direction:column;gap:6px">' +
        '<select onchange="Ventas._onProd('+idx+',this.value)"><option value="">Seleccionar prenda...</option>'+opts+'</select>' +
        '<div style="display:flex;gap:6px">' +
          '<select id="vi-t-'+idx+'" style="flex:1"><option value="">Talla</option></select>' +
          '<input type="number" id="vi-c-'+idx+'" value="1" min="1" style="width:55px" oninput="Ventas._calcTotal()"/>' +
          '<input type="number" id="vi-p-'+idx+'" placeholder="Precio" style="width:85px" oninput="Ventas._calcTotal()"/>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-danger btn-icon btn-sm" onclick="document.getElementById(\'vi-'+idx+'\').remove();Ventas._calcTotal()">✕</button>';
    document.getElementById('v-items').appendChild(div);
  },

  _onProd: function(idx, pid) {
    var data = DB.getDatos();
    var item = (data.inventario||[]).find(function(i){return i.id===pid;});
    if (!item) return;
    var sel = document.getElementById('vi-t-'+idx);
    if (sel) {
      var tallas = Object.entries(item.tallas||{}).filter(function(e){return e[1]>0;});
      sel.innerHTML = '<option value="">Talla</option>' +
        tallas.map(function(e){return '<option value="'+e[0]+'">'+e[0]+' ('+e[1]+')</option>';}).join('');
    }
    var precEl = document.getElementById('vi-p-'+idx);
    if (precEl) precEl.value = item.precio || 0;
    Ventas._calcTotal();
  },

  _addCosto: function() {
    var idx = Ventas._cIdx++;
    var div = document.createElement('div');
    div.className = 'costo-venta-row';
    div.id = 'cv-'+idx;
    div.innerHTML =
      '<input type="text" id="cc-'+idx+'" style="flex:1" placeholder="Concepto"/>' +
      '<input type="number" id="cv'+idx+'" value="0" min="0" style="width:90px" oninput="Ventas._calcTotal()"/>' +
      '<button class="btn btn-ghost btn-icon btn-sm" onclick="this.parentNode.remove();Ventas._calcTotal()">✕</button>';
    document.getElementById('v-costos').appendChild(div);
  },

  _leerItems: function() {
    var data = DB.getDatos();
    var rows = document.querySelectorAll('[id^="vi-"]');
    var items = [];
    rows.forEach(function(row) {
      var idx = row.id.replace('vi-','');
      var sel = row.querySelector('select');
      var pid = sel ? sel.value : '';
      if (!pid) return;
      var prod = (data.inventario||[]).find(function(i){return i.id===pid;});
      var talla = _get('vi-t-'+idx);
      var cant  = parseInt(_get('vi-c-'+idx)||'1')||1;
      var prec  = parseFloat(_get('vi-p-'+idx)||'0')||0;
      items.push({productoId:pid, nombre:prod?prod.nombre:'Prenda', talla:talla,
        cantidad:cant, precio:prec, costoUnitario:prod?prod.costo||0:0, subtotal:prec*cant});
    });
    return items;
  },

  _leerCostos: function() {
    var rows = document.querySelectorAll('[id^="cv-"]');
    var costos = [];
    rows.forEach(function(row) {
      var idx = row.id.replace('cv-','');
      var cat = _get('cc-'+idx);
      var val = parseFloat(row.querySelector('input[type="number"]').value||'0')||0;
      if (cat && val>0) costos.push({concepto:cat, valor:val});
    });
    return costos;
  },

  _calcTotal: function() {
    var items  = Ventas._leerItems();
    var costos = Ventas._leerCostos();
    var ing    = items.reduce(function(a,i){return a+i.subtotal;},0);
    var cp     = items.reduce(function(a,i){return a+(i.costoUnitario*i.cantidad);},0);
    var ca     = costos.reduce(function(a,c){return a+c.valor;},0);
    var total  = cp+ca;
    var gan    = ing-total;
    var margen = ing>0?Math.round(gan/ing*100):0;
    var el = document.getElementById('v-totales');
    if (!el) return;
    el.innerHTML =
      '<div class="total-row"><span>Ingresos</span><span>'+_fmt(ing)+'</span></div>' +
      '<div class="total-row"><span>Costo prendas</span><span>'+_fmt(cp)+'</span></div>' +
      '<div class="total-row"><span>Costos adicionales</span><span>'+_fmt(ca)+'</span></div>' +
      '<div class="total-row total-final"><span>Total recibido</span><span>'+_fmt(ing)+'</span></div>' +
      '<div class="total-row total-ganancia"><span>Ganancia neta ('+margen+'%)</span><span>'+_fmt(gan)+'</span></div>';
  },

  guardar: async function() {
    var fecha   = _get('v-fecha');
    var canal   = _get('v-canal');
    var cliente = _get('v-cliente');
    var notas   = _get('v-notas');
    var items   = Ventas._leerItems();
    var costos  = Ventas._leerCostos();

    if (!fecha)        { Toast.show('Selecciona la fecha','error'); return; }
    if (!items.length) { Toast.show('Agrega al menos un producto','error'); return; }

    var ing = items.reduce(function(a,i){return a+i.subtotal;},0);
    var cp  = items.reduce(function(a,i){return a+(i.costoUnitario*i.cantidad);},0);
    var ca  = costos.reduce(function(a,c){return a+c.valor;},0);
    var costoTotal = cp+ca;

    var data = DB.getDatos();

    /* descontar stock */
    items.forEach(function(item){
      if (!item.talla) return;
      var inv = (data.inventario||[]).find(function(i){return i.id===item.productoId;});
      if (!inv||!inv.tallas) return;
      var actual = inv.tallas[item.talla]||0;
      inv.tallas[item.talla] = Math.max(0, actual - item.cantidad);
    });

    data.ventas = data.ventas || [];
    data.ventas.push({
      id: _uid(), fecha: fecha, mes: fecha.slice(0,7), canal: canal,
      cliente: cliente, notas: notas, items: items, costos: costos,
      total: ing, costoPrendas: cp, costoAdicional: ca, costoTotal: costoTotal,
      ganancia: ing-costoTotal,
      registradoPor: (Auth.getUsuarioActual()||{}).username || 'sistema',
      creadoEn: new Date().toISOString()
    });

    await DB.guardarYPush(data);
    Modal.cerrar();
    Ventas._iIdx = 0; Ventas._cIdx = 1;
    Ventas.render();
    Dashboard.render();
    Toast.show('Venta registrada 🎉','ok');
  },

  verDetalle: function(id) {
    var data  = DB.getDatos();
    var v     = (data.ventas||[]).find(function(x){return x.id===id;});
    if (!v) return;
    var fecha = new Date(v.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'});
    var itemsH = (v.items||[]).map(function(i){
      return '<div class="venta-item-row"><div class="venta-item-info"><div>'+i.nombre+'</div>' +
        '<div class="venta-item-sub">'+(i.talla?'Talla: '+i.talla+' · ':'')+' Cant: '+i.cantidad+'</div></div>' +
        '<div class="venta-item-precio">'+_fmt(i.subtotal)+'</div></div>';
    }).join('');
    var costsH = (v.costos||[]).map(function(c){
      return '<div class="total-row"><span>'+c.concepto+'</span><span>'+_fmt(c.valor)+'</span></div>';
    }).join('');
    var canalH = v.canal==='online'
      ? '<span class="venta-canal canal-online">Online</span>'
      : '<span class="venta-canal canal-fisico">Físico</span>';

    Modal.abrir('Detalle de venta',
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'+canalH+
        '<span style="color:var(--text-secondary);font-size:13px">'+fecha+'</span>'+
        (v.cliente?'<span style="font-size:13px">👤 '+v.cliente+'</span>':'')+
      '</div>' +
      '<div class="form-group"><label>Productos</label><div class="venta-items-lista">'+itemsH+'</div></div>' +
      (v.costos&&v.costos.length?'<div class="form-group"><label>Costos adicionales</label><div class="totales-venta">'+costsH+'</div></div>':'') +
      '<div class="totales-venta">' +
        '<div class="total-row"><span>Ingresos</span><span>'+_fmt(v.total)+'</span></div>' +
        '<div class="total-row"><span>Costo prendas</span><span>'+_fmt(v.costoPrendas)+'</span></div>' +
        '<div class="total-row"><span>Costos adicionales</span><span>'+_fmt(v.costoAdicional)+'</span></div>' +
        '<div class="total-row total-ganancia"><span>Ganancia neta</span><span>'+_fmt(v.ganancia)+'</span></div>' +
      '</div>' +
      (v.notas?'<div style="color:var(--text-secondary);font-size:13px;padding:4px 0">📝 '+v.notas+'</div>':'') +
      '<div class="form-actions">' +
        '<button class="btn btn-danger" onclick="Ventas.eliminar(\''+id+'\')">Eliminar</button>' +
        '<button class="btn btn-ghost" onclick="Modal.cerrar()">Cerrar</button>' +
      '</div>'
    );
  },

  eliminar: async function(id) {
    if (!confirm('¿Eliminar esta venta?')) return;
    var data = DB.getDatos();
    data.ventas = (data.ventas||[]).filter(function(v){return v.id!==id;});
    await DB.guardarYPush(data);
    Modal.cerrar();
    Ventas.render();
    Dashboard.render();
    Toast.show('Venta eliminada','ok');
  }
};

/* ══════════════════════════════════════════
   COSTOS
══════════════════════════════════════════ */
var Costos = {
  _catActiva: '',

  render: function() {
    var data  = DB.getDatos();
    var todos = data.costos || [];
    var cats  = (data.config && data.config.categoriasCosto) || [];

    /* chips de categorías */
    var catsEl = document.getElementById('costos-categorias');
    if (catsEl) {
      var totCat = {};
      todos.forEach(function(c){ totCat[c.categoria] = (totCat[c.categoria]||0) + c.valor; });
      var totalAll = todos.reduce(function(a,c){return a+c.valor;},0);
      catsEl.innerHTML =
        '<div class="costo-cat-chip'+(Costos._catActiva===''?' active':'')+'" onclick="Costos._filtrar(\'\')">Todos <span class="costo-cat-total">'+_fmt(totalAll)+'</span></div>' +
        cats.map(function(cat){
          return '<div class="costo-cat-chip'+(Costos._catActiva===cat?' active':'')+'" onclick="Costos._filtrar(\''+cat+'\')">'+cat+' <span class="costo-cat-total">'+_fmt(totCat[cat]||0)+'</span></div>';
        }).join('');
    }
    Costos._filtrar(Costos._catActiva);
    Costos._renderConfigCats();
  },

  _filtrar: function(cat) {
    Costos._catActiva = cat;
    document.querySelectorAll('.costo-cat-chip').forEach(function(el){
      el.classList.toggle('active', el.textContent.trim().startsWith(cat||'Todos'));
    });
    var data = DB.getDatos();
    var list = (data.costos||[]).filter(function(c){ return !cat || c.categoria===cat; });
    list = list.slice().sort(function(a,b){return new Date(b.fecha)-new Date(a.fecha);});

    var el = document.getElementById('costos-lista');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-title">Sin costos registrados</div><div class="empty-state-sub">Agrega envíos, empaques y otros gastos</div></div>';
      return;
    }
    el.innerHTML = list.map(function(c){
      var fecha = new Date(c.fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
      return '<div class="item-row" onclick="Costos.abrirModal(\''+c.id+'\')">' +
        '<div class="item-row-info"><div class="item-row-title">'+(c.descripcion||c.categoria)+'</div>' +
        '<div class="item-row-sub">'+c.categoria+' · '+fecha+'</div></div>' +
        '<span class="item-row-valor">'+_fmt(c.valor)+'</span></div>';
    }).join('');
  },

  abrirModal: function(costoId) {
    var data  = DB.getDatos();
    var costo = costoId ? (data.costos||[]).find(function(c){return c.id===costoId;}) : null;
    var cats  = (data.config&&data.config.categoriasCosto)||['Envío','Empaque','Publicidad','Arriendo','Nómina','Otro'];
    var hoy   = new Date().toISOString().slice(0,10);

    Modal.abrir(costo?'Editar costo':'Registrar costo',
      '<div class="form-group"><label>Categoría</label><select id="c-cat">' +
        cats.map(function(c){return '<option value="'+c+'"'+(costo&&costo.categoria===c?' selected':'')+'>'+c+'</option>';}).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Descripción</label><input type="text" id="c-desc" value="'+(costo?costo.descripcion||'':'')+'" placeholder="Ej: Envío pedido cliente Juan"/></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Valor ($)</label><input type="number" id="c-valor" value="'+(costo?costo.valor||'':'')+'" placeholder="0" min="0"/></div>' +
        '<div class="form-group"><label>Fecha</label><input type="date" id="c-fecha" value="'+(costo?costo.fecha:hoy)+'"/></div>' +
      '</div>' +
      '<div class="form-group"><label>Notas</label><textarea id="c-notas" placeholder="Notas adicionales...">'+(costo?costo.notas||'':'')+'</textarea></div>' +
      '<div class="form-actions">' +
        (costo?'<button class="btn btn-danger" onclick="Costos.eliminar(\''+costoId+'\')">Eliminar</button>':'') +
        '<button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="Costos.guardar(\''+(costoId||'')+'\')">Guardar</button>' +
      '</div>'
    );
  },

  guardar: async function(costoId) {
    var cat   = _get('c-cat');
    var desc  = _get('c-desc');
    var valor = parseFloat(_get('c-valor'))||0;
    var fecha = _get('c-fecha');
    var notas = _get('c-notas');

    if (!valor) { Toast.show('Ingresa un valor','error'); return; }
    if (!fecha) { Toast.show('Selecciona la fecha','error'); return; }

    var data = DB.getDatos();
    data.costos = data.costos || [];

    if (costoId) {
      var idx = data.costos.findIndex(function(c){return c.id===costoId;});
      if (idx!==-1) Object.assign(data.costos[idx],{categoria:cat,descripcion:desc,valor:valor,fecha:fecha,notas:notas});
    } else {
      data.costos.push({id:_uid(),categoria:cat,descripcion:desc,valor:valor,fecha:fecha,notas:notas,creadoEn:new Date().toISOString()});
    }

    await DB.guardarYPush(data);
    Modal.cerrar();
    Costos.render();
    Toast.show('Costo guardado','ok');
  },

  eliminar: async function(id) {
    if (!confirm('¿Eliminar este costo?')) return;
    var data = DB.getDatos();
    data.costos = (data.costos||[]).filter(function(c){return c.id!==id;});
    await DB.guardarYPush(data);
    Modal.cerrar();
    Costos.render();
    Toast.show('Costo eliminado','ok');
  },

  agregarCategoria: async function() {
    var inp = document.getElementById('cfg-nueva-cat');
    var cat = inp ? inp.value.trim() : '';
    if (!cat) return;
    var data = DB.getDatos();
    data.config = data.config || {};
    data.config.categoriasCosto = data.config.categoriasCosto || [];
    if (data.config.categoriasCosto.indexOf(cat)!==-1) { Toast.show('Ya existe esa categoría','warn'); return; }
    data.config.categoriasCosto.push(cat);
    await DB.guardarYPush(data);
    if (inp) inp.value = '';
    Costos._renderConfigCats();
    Toast.show('Categoría agregada','ok');
  },

  _renderConfigCats: function() {
    var el = document.getElementById('cfg-cats-lista');
    if (!el) return;
    var data = DB.getDatos();
    var cats = (data.config&&data.config.categoriasCosto)||[];
    el.innerHTML = cats.map(function(c){
      return '<div class="item-row"><div class="item-row-info"><div class="item-row-title">'+c+'</div></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="Costos.eliminarCat(\''+c+'\')">✕</button></div>';
    }).join('');
  },

  eliminarCat: async function(cat) {
    var data = DB.getDatos();
    if (!data.config||!data.config.categoriasCosto) return;
    data.config.categoriasCosto = data.config.categoriasCosto.filter(function(c){return c!==cat;});
    await DB.guardarYPush(data);
    Costos._renderConfigCats();
    Toast.show('Categoría eliminada','ok');
  }
};

/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
var Config = {
  render: function() {
    DB.cargarConfigEnUI();
    /* tallas */
    var data = DB.getDatos();
    var inp = document.getElementById('cfg-tallas');
    if (inp) inp.value = ((data.config&&data.config.tallas)||['XS','S','M','L','XL','XXL']).join(',');
    Costos._renderConfigCats();
  },
  guardarTallas: async function() {
    var raw = _get('cfg-tallas');
    var tallas = raw.split(',').map(function(t){return t.trim();}).filter(Boolean);
    if (!tallas.length) { Toast.show('Ingresa al menos una talla','error'); return; }
    var data = DB.getDatos();
    data.config = data.config || {};
    data.config.tallas = tallas;
    await DB.guardarYPush(data);
    Toast.show('Tallas guardadas','ok');
  }
};

/* ══════════════════════════════════════════
   APP ARRANQUE
══════════════════════════════════════════ */
var App = {
  init: function() {
    /* garantizar admin local */
    Auth.crearAdminInicial();

    /* render inmediato */
    Nav.go('dashboard');

    /* sync en background */
    DB.setSyncState('loading');
    DB.pull()
      .then(function(){
        DB.setSyncState('ok');
        Nav.refresh();
        DB.iniciarAutoSync();
      })
      .catch(function(){
        var cfg = localStorage.getItem('unbroken_config');
        DB.setSyncState(cfg ? 'error' : 'idle');
        DB.iniciarAutoSync();
      });
  },
  renderAll: function() { Nav.refresh(); }
};

document.addEventListener('DOMContentLoaded', function() {
  Auth.iniciar();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') Modal.cerrar(); });
});
