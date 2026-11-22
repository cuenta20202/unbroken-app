/* ═══════════════════════════════════════════════════
   UNBROKEN. — data.js
   Sincronización en tiempo real con GitHub
   El repo debe tener un archivo db.json en la raíz
═══════════════════════════════════════════════════ */

const DB = (() => {

  // ── Configuración ──────────────────────────────
  const CFG_KEY = 'unbroken_config';
  const DATA_KEY = 'unbroken_data';
  const SYNC_INTERVAL = 30 * 1000; // 30s

  let _syncTimer = null;
  let _sha = null; // SHA del archivo en GitHub (necesario para hacer PUT)

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
    } catch { return {}; }
  }

  function guardarConfig() {
    const repo  = document.getElementById('cfg-repo')?.value.trim();
    const file  = document.getElementById('cfg-file')?.value.trim() || 'db.json';
    const token = document.getElementById('cfg-token')?.value.trim();

    if (!repo) { Toast.show('Ingresa el repositorio (usuario/repo)', 'error'); return; }

    const cfg = { repo, file, token: token || getConfig().token };
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));

    // Rellenar campo token del login
    if (token) localStorage.setItem('unbroken_github_token', token);

    Toast.show('Configuración guardada', 'ok');
    sincronizar(true);
  }

  function cargarConfigEnUI() {
    const cfg = getConfig();
    const tokenLS = localStorage.getItem('unbroken_github_token') || '';
    if (document.getElementById('cfg-repo'))  document.getElementById('cfg-repo').value  = cfg.repo  || '';
    if (document.getElementById('cfg-file'))  document.getElementById('cfg-file').value  = cfg.file  || 'db.json';
    if (document.getElementById('cfg-token')) document.getElementById('cfg-token').value = cfg.token || tokenLS;
  }

  // ── Estructura vacía ───────────────────────────
  function dataVacia() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      usuarios: [],
      inventario: [],
      ventas: [],
      costos: [],
      config: {
        tallas: ['XS','S','M','L','XL','XXL'],
        categoriasCosto: ['Envío','Empaque','Publicidad','Arriendo','Nómina','Otro']
      }
    };
  }

  // ── Datos locales ─────────────────────────────
  function getDatos() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      return raw ? JSON.parse(raw) : dataVacia();
    } catch { return dataVacia(); }
  }

  function setDatos(data) {
    data.updatedAt = new Date().toISOString();
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  // ── API GitHub ────────────────────────────────
  async function apiGet(url, token) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function apiPut(url, token, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
    return res.json();
  }

  function apiUrl(cfg) {
    const file = cfg.file || 'db.json';
    return `https://api.github.com/repos/${cfg.repo}/contents/${file}`;
  }

  // ── PULL — descargar desde GitHub ─────────────
  async function pull() {
    const cfg = getConfig();
    const token = cfg.token || localStorage.getItem('unbroken_github_token');
    if (!cfg.repo || !token) return; // Sin configurar

    setSyncState('loading');
    try {
      const res = await apiGet(apiUrl(cfg), token);
      _sha = res.sha;
      const content = JSON.parse(atob(res.content.replace(/\n/g, '')));
      setDatos(content);
      setSyncState('ok');
      return content;
    } catch (e) {
      setSyncState('error');
      console.error('[DB] pull error:', e);
      throw e;
    }
  }

  // ── PUSH — subir a GitHub ─────────────────────
  async function push() {
    const cfg = getConfig();
    const token = cfg.token || localStorage.getItem('unbroken_github_token');
    if (!cfg.repo || !token) return;

    setSyncState('loading');
    try {
      const data = getDatos();
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const body = {
        message: `update: ${new Date().toISOString()}`,
        content,
        ...(  _sha ? { sha: _sha } : {})
      };
      const res = await apiPut(apiUrl(cfg), token, body);
      _sha = res.content.sha;
      setSyncState('ok');
    } catch (e) {
      setSyncState('error');
      console.error('[DB] push error:', e);
      throw e;
    }
  }

  // ── SINCRONIZAR ───────────────────────────────
  async function sincronizar(force = false) {
    try {
      await pull();
      App.renderAll(); // Refrescar UI
    } catch (e) {
      if (force) Toast.show('Error al sincronizar con GitHub', 'error');
    }
  }

  function iniciarAutoSync() {
    if (_syncTimer) clearInterval(_syncTimer);
    _syncTimer = setInterval(() => sincronizar(), SYNC_INTERVAL);
  }

  function detenerAutoSync() {
    if (_syncTimer) clearInterval(_syncTimer);
    _syncTimer = null;
  }

  // ── Guardar y pushear ─────────────────────────
  async function guardarYPush(data) {
    setDatos(data);
    App.renderAll();
    try {
      await push();
    } catch (e) {
      Toast.show('Guardado local. Fallo sync GitHub.', 'warn');
    }
  }

  // ── Indicador visual ──────────────────────────
  function setSyncState(state) {
    const dot = document.getElementById('sync-indicator');
    if (!dot) return;
    dot.className = 'sync-dot';
    dot.classList.add('sync-' + state);
    dot.title = { loading: 'Sincronizando...', ok: 'Sincronizado', error: 'Error de sync', idle: 'Sin configurar' }[state] || '';
  }

  // ── Público ───────────────────────────────────
  return {
    getDatos,
    setDatos,
    guardarYPush,
    pull,
    push,
    sincronizar,
    iniciarAutoSync,
    detenerAutoSync,
    guardarConfig,
    cargarConfigEnUI,
    setSyncState
  };

})();
