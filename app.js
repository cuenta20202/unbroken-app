/* ═══════════════════════════════════════════════════
   UNBROKEN. — app.js
   Núcleo: Nav, Modal, Toast, Dashboard y arranque
═══════════════════════════════════════════════════ */

// ══════════════════════════════════════════
// NAVEGACIÓN
// ══════════════════════════════════════════
const Nav = {
  _actual: 'dashboard',

  go(view) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });

    const el = document.getElementById('view-' + view);
    if (el) {
      el.style.display = 'block';
      el.classList.add('active');
    }

    const titles = {
      dashboard: 'Inicio',
      inventario: 'Inventario',
      ventas: 'Ventas',
      costos: 'Costos',
      usuarios: 'Usuarios',
      config: 'Configuración'
    };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[view] || view;

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    Nav._actual = view;
    Nav._onEnter(view);
  },

  _onEnter(view) {
    try {
      switch (view) {
        case 'dashboard':  Dashboard.render();              break;
        case 'inventario': Inventario.render();             break;
        case 'ventas':     Contabilidad.renderVentas();     break;
        case 'costos':     Costos.render();                 break;
        case 'usuarios':   Auth.renderUsuarios();           break;
        case 'config':
          DB.cargarConfigEnUI();
          Inventario.cargarTallasEnUI();
          Costos._renderConfigCats();
          break;
      }
    } catch(e) {
      console.error('[Nav] error en vista', view, e);
    }
  }
};

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
const Modal = {
  abrir(titulo, htmlBody) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-body').innerHTML = htmlBody;
    overlay.classList.remove('hidden');
    setTimeout(() => {
      const first = overlay.querySelector('input:not([readonly]), select, textarea');
      if (first) first.focus();
    }, 300);
  },

  cerrar(e) {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }
};

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
const Toast = {
  _timer: null,
  show(msg, tipo) {
    tipo = tipo || '';
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast' + (tipo ? ' toast-' + tipo : '');
    el.classList.remove('hidden');
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.add('hidden'), 3500);
  }
};

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
const Dashboard = {
  render() {
    const data = DB.getDatos();
    const mes  = new Date().toISOString().slice(0, 7);
    const ventasMes = (data.ventas || []).filter(function(v){ return v.mes === mes; });

    let ingresos = 0, costosTot = 0;
    ventasMes.forEach(function(v){ ingresos += v.total || 0; costosTot += v.costoTotal || 0; });

    const prendas = (data.inventario || []).reduce(function(a, i){
      return a + Object.values(i.tallas || {}).reduce(function(s, q){ return s + q; }, 0);
    }, 0);

    _setKPI('kpi-ingresos', ingresos);
    _setKPI('kpi-costos', costosTot);
    _setKPI('kpi-ganancia', ingresos - costosTot, true);
    const kpiPrendas = document.getElementById('kpi-prendas');
    if (kpiPrendas) kpiPrendas.textContent = prendas;

    // Últimas ventas
    const listaVentas = document.getElementById('dashboard-ventas-recientes');
    if (listaVentas) {
      const ultimas = ventasMes
        .slice()
        .sort(function(a, b){ return new Date(b.fecha) - new Date(a.fecha); })
        .slice(0, 5);

      if (ultimas.length === 0) {
        listaVentas.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0">Sin ventas este mes aún</div>';
      } else {
        listaVentas.innerHTML = ultimas.map(function(v){
          const ganancia = (v.total || 0) - (v.costoTotal || 0);
          const fecha = new Date(v.fecha).toLocaleDateString('es-CO', { day:'2-digit', month:'short' });
          return '<div class="item-row" onclick="Contabilidad.abrirDetalleVenta(\'' + v.id + '\')">' +
            '<div class="item-row-info">' +
              '<div class="item-row-title">' + (v.cliente || 'Venta directa') + '</div>' +
              '<div class="item-row-sub">' + fecha + ' · ' + (v.canal === 'online' ? 'Online' : 'Físico') + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div class="item-row-valor">' + _fmt(v.total) + '</div>' +
              '<div style="font-size:11px;color:var(--green)">+' + _fmt(ganancia) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    Inventario.renderStockBajo();
  }
};

function _setKPI(id, valor, colorize) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = _fmt(valor);
  if (colorize) el.style.color = valor >= 0 ? '' : 'var(--red)';
}

function _fmt(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Number(n).toLocaleString('es-CO');
}

// ══════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════
const App = {
  async init() {
    // 1. Garantizar admin local sin esperar red
    Auth.crearAdminInicial();

    // 2. Render inmediato con datos locales
    Nav.go('dashboard');

    // 3. Sync en segundo plano (no bloquea UI)
    DB.setSyncState('loading');
    DB.pull()
      .then(function(){
        DB.setSyncState('ok');
        App.renderAll();
        DB.iniciarAutoSync();
      })
      .catch(function(){
        const cfg = localStorage.getItem('unbroken_config');
        DB.setSyncState(cfg ? 'error' : 'idle');
        DB.iniciarAutoSync();
      });
  },

  renderAll() {
    Nav._onEnter(Nav._actual);
  }
};

// ══════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  // Ocultar todas las vistas excepto dashboard al inicio
  document.querySelectorAll('.view').forEach(function(v){
    v.style.display = 'none';
    v.classList.remove('active');
  });

  Auth.iniciar();

  // Service Worker para PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') Modal.cerrar();
  });
});
