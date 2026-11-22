/* ═══════════════════════════════════════════════════
   UNBROKEN. — auth.js
   Sistema de múltiples usuarios con roles (admin / staff)
   Las cuentas se guardan en db.json (GitHub)
═══════════════════════════════════════════════════ */

const Auth = (() => {

  const SESSION_KEY = 'unbroken_session';

  // ── Sesión ─────────────────────────────────────
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function estaLogueado() {
    return !!getSession();
  }

  function esAdmin() {
    const s = getSession();
    return s && s.rol === 'admin';
  }

  function getUsuarioActual() {
    return getSession();
  }

  // ── Guardar token desde login ──────────────────
  function saveToken() {
    const t = document.getElementById('github-token-input')?.value.trim();
    if (!t) { Toast.show('Ingresa el token primero', 'error'); return; }
    localStorage.setItem('unbroken_github_token', t);
    // Si ya hay config, actualizar el token ahí también
    const cfg = JSON.parse(localStorage.getItem('unbroken_config') || '{}');
    cfg.token = t;
    localStorage.setItem('unbroken_config', JSON.stringify(cfg));
    Toast.show('Token guardado', 'ok');
  }

  // ── LOGIN ──────────────────────────────────────
  async function login() {
    const username = document.getElementById('login-user')?.value.trim().toLowerCase();
    const password = document.getElementById('login-pass')?.value;
    const errEl = document.getElementById('login-error');

    if (!username || !password) {
      errEl?.classList.remove('hidden');
      errEl && (errEl.textContent = 'Completa usuario y contraseña');
      return;
    }

    // Garantizar que el admin por defecto siempre existe localmente
    _garantizarAdminLocal();

    // Intentar sync con GitHub (no bloqueante)
    try { await DB.pull(); } catch (e) { /* sin conexión: usar datos locales */ }

    const data = DB.getDatos();
    const user = data.usuarios.find(u =>
      u.username.toLowerCase() === username &&
      u.password === _hash(password) &&
      u.activo !== false
    );

    if (!user) {
      errEl?.classList.remove('hidden');
      errEl && (errEl.textContent = 'Usuario o contraseña incorrectos');
      return;
    }

    errEl?.classList.add('hidden');
    setSession({ id: user.id, nombre: user.nombre, username: user.username, rol: user.rol });
    mostrarApp();
  }

  // Inyecta admin por defecto en localStorage si no hay ningún usuario guardado
  function _garantizarAdminLocal() {
    const data = DB.getDatos();
    if (data.usuarios && data.usuarios.length > 0) return; // ya hay usuarios
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

  // ── LOGOUT ──────────────────────��──────────────
  function logout() {
    DB.detenerAutoSync();
    clearSession();
    mostrarLogin();
  }

  // ── INICIAR APP ────────────────────────────────
  function iniciar() {
    if (estaLogueado()) {
      mostrarApp();
    } else {
      mostrarLogin();
    }
  }

  function mostrarLogin() {
    document.getElementById('screen-login')?.classList.remove('hidden');
    document.getElementById('screen-login')?.classList.add('active');
    document.getElementById('screen-app')?.classList.add('hidden');
    document.getElementById('screen-app')?.classList.remove('active');
  }

  function mostrarApp() {
    document.getElementById('screen-login')?.classList.add('hidden');
    document.getElementById('screen-login')?.classList.remove('active');
    document.getElementById('screen-app')?.classList.remove('hidden');
    document.getElementById('screen-app')?.classList.add('active');

    const user = getSession();
    const badge = document.getElementById('current-user-badge');
    if (badge) badge.textContent = user?.nombre || user?.username || '';

    // Mostrar/ocultar sección usuarios según rol
    const btnUsuarios = document.querySelector('[data-view="usuarios"]');
    // No hay tab de usuarios en el nav, se accede desde config si es admin
    renderTabUsuarios();

    App.init();
  }

  function renderTabUsuarios() {
    const btn = document.getElementById('nav-btn-usuarios');
    if (btn) btn.style.display = esAdmin() ? 'flex' : 'none';
  }

  // ── GESTIÓN DE USUARIOS ────────────────────────
  function abrirModalUsuario(userId = null) {
    if (!esAdmin()) { Toast.show('Solo el admin puede gestionar usuarios', 'error'); return; }

    const data = DB.getDatos();
    const user = userId ? data.usuarios.find(u => u.id === userId) : null;

    Modal.abrir(user ? 'Editar usuario' : 'Nuevo usuario', `
      <div class="form-group">
        <label>Nombre completo</label>
        <input type="text" id="u-nombre" value="${user?.nombre || ''}" placeholder="Nombre y apellido" />
      </div>
      <div class="form-group">
        <label>Usuario</label>
        <input type="text" id="u-username" value="${user?.username || ''}" placeholder="usuario123" ${user ? 'readonly' : ''} />
      </div>
      <div class="form-group">
        <label>${user ? 'Nueva contraseña (dejar vacío = no cambiar)' : 'Contraseña'}</label>
        <input type="password" id="u-password" placeholder="••••••••" />
      </div>
      <div class="form-group">
        <label>Rol</label>
        <select id="u-rol">
          <option value="staff" ${user?.rol === 'staff' ? 'selected' : ''}>Staff (vendedor)</option>
          <option value="admin" ${user?.rol === 'admin' ? 'selected' : ''}>Admin (acceso total)</option>
        </select>
      </div>
      ${user ? `
      <div class="form-group">
        <label>Estado</label>
        <select id="u-activo">
          <option value="1" ${user.activo !== false ? 'selected' : ''}>Activo</option>
          <option value="0" ${user.activo === false ? 'selected' : ''}>Inactivo</option>
        </select>
      </div>` : ''}
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="Modal.cerrar()">Cancelar</button>
        <button class="btn btn-primary" onclick="Auth.guardarUsuario('${userId || ''}')">Guardar</button>
      </div>
    `);
  }

  async function guardarUsuario(userId) {
    const nombre   = document.getElementById('u-nombre')?.value.trim();
    const username = document.getElementById('u-username')?.value.trim().toLowerCase();
    const password = document.getElementById('u-password')?.value;
    const rol      = document.getElementById('u-rol')?.value;
    const activoEl = document.getElementById('u-activo');

    if (!nombre || !username) { Toast.show('Nombre y usuario son obligatorios', 'error'); return; }
    if (!userId && !password)  { Toast.show('La contraseña es obligatoria para usuario nuevo', 'error'); return; }

    const data = DB.getDatos();

    if (userId) {
      // Editar
      const idx = data.usuarios.findIndex(u => u.id === userId);
      if (idx === -1) return;
      data.usuarios[idx].nombre = nombre;
      data.usuarios[idx].rol = rol;
      if (activoEl) data.usuarios[idx].activo = activoEl.value === '1';
      if (password) data.usuarios[idx].password = _hash(password);
    } else {
      // Crear
      if (data.usuarios.some(u => u.username === username)) {
        Toast.show('Ese usuario ya existe', 'error'); return;
      }
      data.usuarios.push({
        id: _uid(),
        nombre,
        username,
        password: _hash(password),
        rol,
        activo: true,
        creadoEn: new Date().toISOString()
      });
    }

    await DB.guardarYPush(data);
    Modal.cerrar();
    renderUsuarios();
    Toast.show(userId ? 'Usuario actualizado' : 'Usuario creado', 'ok');
  }

  function renderUsuarios() {
    const lista = document.getElementById('usuarios-lista');
    if (!lista) return;
    const data = DB.getDatos();

    if (data.usuarios.length === 0) {
      lista.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Sin usuarios</div><div class="empty-state-sub">Agrega el primer usuario</div></div>`;
      return;
    }

    lista.innerHTML = data.usuarios.map(u => `
      <div class="item-row" onclick="Auth.abrirModalUsuario('${u.id}')">
        <div class="item-row-info">
          <div class="item-row-title">${u.nombre}</div>
          <div class="item-row-sub">@${u.username} ${u.activo === false ? '· <span style="color:var(--red)">Inactivo</span>' : ''}</div>
        </div>
        <span class="user-row-rol rol-${u.rol}">${u.rol === 'admin' ? 'Admin' : 'Staff'}</span>
      </div>
    `).join('');
  }

  // ── Resetear acceso de emergencia ─────────────
  function resetearAcceso() {
    if (!confirm('Esto borrará los datos locales e inyectará el admin por defecto.\n\nUsuario: admin\nContraseña: unbroken2024\n\n¿Continuar?')) return;
    // Borrar solo la parte de usuarios del data, conservar inventario/ventas/costos
    const data = DB.getDatos();
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
    localStorage.removeItem('unbroken_session');
    // Limpiar campos
    document.getElementById('login-user').value = 'admin';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').classList.add('hidden');
    alert('Listo. Entra con: admin / unbroken2024');
  }
  async function crearAdminInicial() {
    const data = DB.getDatos();
    if (data.usuarios && data.usuarios.length > 0) return;

    data.usuarios = data.usuarios || [];
    data.usuarios.push({
      id: 'admin001',
      nombre: 'Admin',
      username: 'admin',
      password: _hash('unbroken2024'),
      rol: 'admin',
      activo: true,
      creadoEn: new Date().toISOString()
    });
    // Guardar local primero, push en segundo plano
    DB.setDatos(data);
    DB.push().catch(() => {}); // no bloquear si falla
  }

  // ── Utilidades ─────────────────────────────────
  function _hash(str) {
    // Hash simple para contraseñas (producción debería usar bcrypt en servidor)
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return 'h' + Math.abs(h).toString(36);
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    iniciar,
    login,
    logout,
    estaLogueado,
    esAdmin,
    getUsuarioActual,
    saveToken,
    abrirModalUsuario,
    guardarUsuario,
    renderUsuarios,
    crearAdminInicial,
    resetearAcceso
  };

})();
