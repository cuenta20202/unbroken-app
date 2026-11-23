/* ═══════════════════════════════════════════════════
   UNBROKEN. — auth.js  v3
   Fix: guardarUsuario sin async/await problemático en Safari
═══════════════════════════════════════════════════ */

var Auth = (function() {

  var SESSION_KEY = 'unbroken_session';

  /* ── sesión ── */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch(e) { return null; }
  }
  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function estaLogueado() { return !!getSession(); }
  function esAdmin() { var s = getSession(); return s && s.rol === 'admin'; }
  function getUsuarioActual() { return getSession(); }

  /* ── guardar token ── */
  function saveToken() {
    var inp = document.getElementById('github-token-input');
    var t = inp ? inp.value.trim() : '';
    if (!t) { Toast.show('Ingresa el token primero', 'error'); return; }
    localStorage.setItem('unbroken_github_token', t);
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('unbroken_config') || '{}'); } catch(e){}
    cfg.token = t;
    localStorage.setItem('unbroken_config', JSON.stringify(cfg));
    Toast.show('Token guardado ✓', 'ok');
  }

  /* ── LOGIN ── */
  function login() {
    var userEl = document.getElementById('login-user');
    var passEl = document.getElementById('login-pass');
    var errEl  = document.getElementById('login-error');
    var username = userEl ? userEl.value.trim().toLowerCase() : '';
    var password = passEl ? passEl.value : '';

    if (!username || !password) {
      if (errEl) { errEl.textContent = 'Completa usuario y contraseña'; errEl.classList.remove('hidden'); }
      return;
    }

    /* garantizar admin local antes de cualquier cosa */
    _garantizarAdminLocal();

    /* intentar sync — no bloqueante, login con datos locales si falla */
    DB.pull()
      .catch(function() {})
      .then(function() {
        var data = DB.getDatos();
        var user = null;
        for (var i = 0; i < data.usuarios.length; i++) {
          var u = data.usuarios[i];
          if (u.username.toLowerCase() === username &&
              u.password === _hash(password) &&
              u.activo !== false) {
            user = u; break;
          }
        }
        if (!user) {
          if (errEl) { errEl.textContent = 'Usuario o contraseña incorrectos'; errEl.classList.remove('hidden'); }
          return;
        }
        if (errEl) errEl.classList.add('hidden');
        setSession({ id: user.id, nombre: user.nombre, username: user.username, rol: user.rol });
        mostrarApp();
      });
  }

  function _garantizarAdminLocal() {
    var data = DB.getDatos();
    if (data.usuarios && data.usuarios.length > 0) return;
    data.usuarios = [{
      id: 'admin001',
      nombre: 'Admin',
      username: 'admin',
      password: _hash('unbroken2024'),
      rol: 'admin',
      activo: true,
      creadoEn: new Date().toISOString()
    }];
    DB.setDatos(data);
  }

  /* ── LOGOUT ── */
  function logout() {
    DB.detenerAutoSync();
    clearSession();
    mostrarLogin();
  }

  /* ── pantallas ── */
  function iniciar() {
    if (estaLogueado()) mostrarApp();
    else mostrarLogin();
  }

  function mostrarLogin() {
    var sl = document.getElementById('screen-login');
    var sa = document.getElementById('screen-app');
    if (sl) { sl.classList.remove('hidden'); sl.classList.add('active'); }
    if (sa) { sa.classList.add('hidden');    sa.classList.remove('active'); }
  }

  function mostrarApp() {
    var sl = document.getElementById('screen-login');
    var sa = document.getElementById('screen-app');
    if (sl) { sl.classList.add('hidden');    sl.classList.remove('active'); }
    if (sa) { sa.classList.remove('hidden'); sa.classList.add('active'); }

    var user  = getSession();
    var badge = document.getElementById('current-user-badge');
    if (badge) badge.textContent = user ? (user.nombre || user.username) : '';

    _renderTabUsuarios();
    App.init();
  }

  function _renderTabUsuarios() {
    var btn = document.getElementById('nav-btn-usuarios');
    if (btn) btn.style.display = esAdmin() ? 'flex' : 'none';
  }

  /* ═══════════════════════════════════════════
     GESTIÓN DE USUARIOS — sin async/template literals
     (Safari antigua tiene bugs con await dentro de onclick)
  ═══════════════════════════════════════════ */
  function abrirModalUsuario(userId) {
    userId = userId || null;
    if (!esAdmin()) { Toast.show('Solo el admin puede gestionar usuarios', 'error'); return; }

    var data = DB.getDatos();
    var user = userId ? _findUser(data, userId) : null;

    var estadoHtml = '';
    if (user) {
      estadoHtml =
        '<div class="form-group"><label>Estado</label><select id="u-activo">' +
          '<option value="1"' + (user.activo !== false ? ' selected' : '') + '>Activo</option>' +
          '<option value="0"' + (user.activo === false ? ' selected' : '') + '>Inactivo</option>' +
        '</select></div>';
    }

    Modal.abrir(user ? 'Editar usuario' : 'Nuevo usuario',
      '<div class="form-group"><label>Nombre completo</label>' +
        '<input type="text" id="u-nombre" value="' + (user ? _esc(user.nombre) : '') + '" placeholder="Nombre y apellido" autocomplete="off" /></div>' +

      '<div class="form-group"><label>Usuario (sin espacios)</label>' +
        '<input type="text" id="u-username" value="' + (user ? _esc(user.username) : '') + '" placeholder="usuario123" ' +
        (user ? 'readonly style="opacity:0.6"' : '') + ' autocomplete="off" /></div>' +

      '<div class="form-group"><label>' + (user ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña') + '</label>' +
        '<input type="password" id="u-password" placeholder="••••••••" autocomplete="new-password" /></div>' +

      '<div class="form-group"><label>Rol</label><select id="u-rol">' +
        '<option value="staff"' + (user && user.rol === 'staff' ? ' selected' : '') + '>Staff — solo ventas e inventario</option>' +
        '<option value="admin"' + (user && user.rol === 'admin' ? ' selected' : '') + '>Admin — acceso total</option>' +
      '</select></div>' +

      estadoHtml +

      '<div class="form-actions">' +
        '<button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>' +
        '<button class="btn btn-primary" onclick="Auth.guardarUsuario(\'' + (userId || '') + '\')">Guardar</button>' +
      '</div>'
    );
  }

  function guardarUsuario(userId) {
    var nombre   = _val('u-nombre');
    var username = _val('u-username').toLowerCase().replace(/\s/g, '');
    var password = _val('u-password');
    var rol      = _val('u-rol');
    var activoEl = document.getElementById('u-activo');

    if (!nombre || !username) { Toast.show('Nombre y usuario son obligatorios', 'error'); return; }
    if (!userId && !password) { Toast.show('La contraseña es obligatoria', 'error'); return; }

    var data = DB.getDatos();

    if (userId) {
      var idx = _findIdx(data, userId);
      if (idx === -1) { Toast.show('Usuario no encontrado', 'error'); return; }
      data.usuarios[idx].nombre = nombre;
      data.usuarios[idx].rol    = rol;
      if (activoEl) data.usuarios[idx].activo = activoEl.value === '1';
      if (password) data.usuarios[idx].password = _hash(password);
    } else {
      var exists = false;
      for (var i = 0; i < data.usuarios.length; i++) {
        if (data.usuarios[i].username === username) { exists = true; break; }
      }
      if (exists) { Toast.show('Ese usuario ya existe', 'error'); return; }
      data.usuarios.push({
        id: _uid(),
        nombre: nombre,
        username: username,
        password: _hash(password),
        rol: rol,
        activo: true,
        creadoEn: new Date().toISOString()
      });
    }

    /* guardar local inmediatamente, push en background */
    DB.setDatos(data);
    Modal.cerrar();
    renderUsuarios();
    Toast.show(userId ? 'Usuario actualizado ✓' : 'Usuario creado ✓', 'ok');

    /* push asíncrono sin bloquear UI */
    DB.push().catch(function() {
      Toast.show('Guardado local. Fallo sync.', 'warn');
    });
  }

  function renderUsuarios() {
    var lista = document.getElementById('usuarios-lista');
    if (!lista) return;
    var data = DB.getDatos();
    if (!data.usuarios || !data.usuarios.length) {
      lista.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">👤</div>' +
        '<div class="empty-state-title">Sin usuarios</div>' +
        '<div class="empty-state-sub">Agrega el primer usuario</div></div>';
      return;
    }
    lista.innerHTML = data.usuarios.map(function(u) {
      return '<div class="item-row" onclick="Auth.abrirModalUsuario(\'' + u.id + '\')">' +
        '<div class="item-row-info">' +
          '<div class="item-row-title">' + _esc(u.nombre) + '</div>' +
          '<div class="item-row-sub">@' + u.username +
            (u.activo === false ? ' · <span style="color:var(--red)">Inactivo</span>' : '') +
          '</div>' +
        '</div>' +
        '<span class="user-row-rol rol-' + u.rol + '">' + (u.rol === 'admin' ? 'Admin' : 'Staff') + '</span>' +
      '</div>';
    }).join('');
  }

  /* ── admin inicial ── */
  function crearAdminInicial() {
    var data = DB.getDatos();
    if (data.usuarios && data.usuarios.length > 0) return;
    data.usuarios = [{
      id: 'admin001', nombre: 'Admin', username: 'admin',
      password: _hash('unbroken2024'), rol: 'admin',
      activo: true, creadoEn: new Date().toISOString()
    }];
    DB.setDatos(data);
    DB.push().catch(function(){});
  }

  /* ── resetear acceso ── */
  function resetearAcceso() {
    if (!confirm('Se restablece el admin por defecto.\n\nUsuario: admin\nContraseña: unbroken2024\n\n¿Continuar?')) return;
    var data = DB.getDatos();
    data.usuarios = [{
      id: 'admin001', nombre: 'Admin', username: 'admin',
      password: _hash('unbroken2024'), rol: 'admin',
      activo: true, creadoEn: new Date().toISOString()
    }];
    DB.setDatos(data);
    clearSession();
    var userEl = document.getElementById('login-user');
    var passEl = document.getElementById('login-pass');
    var errEl  = document.getElementById('login-error');
    if (userEl) userEl.value = 'admin';
    if (passEl) passEl.value = '';
    if (errEl)  errEl.classList.add('hidden');
    alert('Listo. Entra con: admin / unbroken2024');
  }

  /* ── utils ── */
  function _hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return 'h' + Math.abs(h).toString(36);
  }
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function _val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function _esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _findUser(data, id) {
    for (var i = 0; i < data.usuarios.length; i++) {
      if (data.usuarios[i].id === id) return data.usuarios[i];
    }
    return null;
  }
  function _findIdx(data, id) {
    for (var i = 0; i < data.usuarios.length; i++) {
      if (data.usuarios[i].id === id) return i;
    }
    return -1;
  }

  return {
    iniciar: iniciar,
    login: login,
    logout: logout,
    estaLogueado: estaLogueado,
    esAdmin: esAdmin,
    getUsuarioActual: getUsuarioActual,
    saveToken: saveToken,
    abrirModalUsuario: abrirModalUsuario,
    guardarUsuario: guardarUsuario,
    renderUsuarios: renderUsuarios,
    crearAdminInicial: crearAdminInicial,
    resetearAcceso: resetearAcceso
  };

}());
