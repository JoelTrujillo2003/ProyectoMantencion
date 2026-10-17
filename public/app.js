/* Interfaz de Garage Premium. El servidor y Supabase deciden los permisos. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const catalog = window.vehicleDB;
  const rules = globalThis.GarageVehicleRules;
  const catalogUI = window.GarageCatalogUI;
  const auth = window.GarageAuth;
  const oauthCallback = auth.readCallback(location.href);
  if (oauthCallback.active) history.replaceState({}, '', oauthCallback.cleanUrl);
  const emptyAccount = () => ({ isPremium: false, canUseAi: false, canAddVehicle: false, vehicleCount: 0 });
  let client, user = null, account = emptyAccount(), config = {}, authMode = 'login';
  let premiumKeys = new Set(window.premiumVehicleCatalog.map(v => [v.type,v.brand,v.model].join('\u0000'))), sessionVersion = 0, analysisVersion = 0;
  let analyzing = false, saving = false, authBusy = false, checkoutBusy = false, toastTimer;
  const vehicleKey = (type, brand, model) => [type, brand, model].join('\u0000');
  const vehicleType = () => document.querySelector('input[name="vehicleType"]:checked')?.value || '';
  const message = (id, text = '', error = false) => {
    const el = $(id); el.textContent = text; el.hidden = !text;
    el.classList.toggle('error', error); el.classList.toggle('success', Boolean(text) && !error);
  };
  function toast(text) {
    $('toast').textContent = text; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6500);
  }
  function errorText(error) {
    if (error.code === 'server_not_configured') return 'El acceso a cuentas aún no está habilitado. Puedes explorar el catálogo de Chile sin iniciar sesión.';
    if (error.code === 'PGRST205') return 'Falta preparar la base de datos. Ejecuta la migración 001_freemium.sql en Supabase.';
    if (/Invalid login credentials/i.test(error.message)) return 'El correo o la contraseña no coinciden.';
    if (/Email not confirmed/i.test(error.message)) return 'Confirma tu correo antes de iniciar sesión.';
    if (/fetch|network|Failed to fetch/i.test(error.message)) return 'No pudimos conectar. Revisa tu conexión y que el servidor esté iniciado.';
    return error.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
  async function api(path, options = {}) {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Inicia sesión para continuar.');
    const response = await fetch('/api/' + path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const dataResponse = await response.json();
    if (!response.ok) throw Object.assign(new Error(dataResponse.error), { code: dataResponse.code });
    return dataResponse;
  }
  function setAuthMode(mode) {
    if (authBusy) return;
    authMode = mode === 'signup' ? 'signup' : 'login';
    const signup = authMode === 'signup';
    $('login-tab').classList.toggle('active', !signup); $('signup-tab').classList.toggle('active', signup);
    $('login-tab').setAttribute('aria-pressed', String(!signup)); $('signup-tab').setAttribute('aria-pressed', String(signup));
    $('auth-title').textContent = signup ? 'Todo comienza con tu cuenta.' : 'Qué bueno verte de nuevo.';
    $('auth-description').textContent = signup ? 'Tu primer garage es gratis. Sin tarjeta.' : 'Tu garage te está esperando.';
    $('auth-submit').textContent = signup ? 'Crear mi cuenta ↗' : 'Entrar a mi garage ↗';
    $('password').autocomplete = signup ? 'new-password' : 'current-password';
    $('password').minLength = signup ? 8 : 1;
    $('password-help').hidden = !signup; message('auth-message');
  }
  function updateAuthControls() {
    $('auth-submit').disabled = !client || authBusy;
    $('login-tab').disabled = authBusy; $('signup-tab').disabled = authBusy;
    document.querySelectorAll('[data-oauth-provider]').forEach(button => {
      const enabled = Boolean(client && config.socialProviders?.includes(button.dataset.oauthProvider));
      button.disabled = !enabled || authBusy;
      button.title = enabled ? `Continuar con ${auth.providers[button.dataset.oauthProvider]}` : `${auth.providers[button.dataset.oauthProvider]}: acceso aún no habilitado`;
    });
  }
  function preserveFeedbackDraft() {
    const subject = $('feedback-subject').value, text = $('feedback-message').value;
    if (!subject && !text) return;
    try { sessionStorage.setItem('garage-feedback-oauth-draft', JSON.stringify({ subject, text, type: $('feedback-type').value, consent: $('feedback-consent').checked, at: Date.now() })); } catch { /* El acceso sigue disponible si el almacenamiento está bloqueado. */ }
  }
  function restoreFeedbackDraft() {
    try {
      const raw = sessionStorage.getItem('garage-feedback-oauth-draft');
      sessionStorage.removeItem('garage-feedback-oauth-draft');
      const draft = raw && JSON.parse(raw);
      if (!draft || Date.now() - draft.at > 30 * 60 * 1000) return;
      if (typeof draft.subject === 'string') $('feedback-subject').value = draft.subject.slice(0, 120);
      if (typeof draft.text === 'string') $('feedback-message').value = draft.text.slice(0, 2000);
      if (['suggestion','bug','vehicle_request','other'].includes(draft.type)) $('feedback-type').value = draft.type;
      $('feedback-consent').checked = draft.consent === true;
      $('feedback-counter').textContent = `${$('feedback-message').value.length} / 2000`;
    } catch { /* Un borrador inválido no bloquea el acceso. */ }
  }
  async function authenticateWithProvider(provider) {
    if (authBusy || !client || !config.socialProviders?.includes(provider) || !auth.supported(provider)) return;
    authBusy = true; updateAuthControls(); message('auth-message');
    message('auth-message', `Abriendo el acceso de ${auth.providers[provider]}…`);
    try {
      const url = await auth.start(client, provider, location.origin, config.supabaseUrl);
      preserveFeedbackDraft();
      location.assign(url);
    } catch (error) {
      authBusy = false; updateAuthControls(); message('auth-message', auth.errorText(error), true);
    }
  }
  async function authenticate(event) {
    event.preventDefault(); if (authBusy || !client) return;
    authBusy = true; updateAuthControls(); $('auth-submit').textContent = 'Un momento…'; message('auth-message');
    try {
      const credentials = { email: $('email').value.trim(), password: $('password').value };
      const result = authMode === 'signup' ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: auth.callbackUrl(location.origin) } }) : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      $('password').value = '';
      if (!result.data.session) message('auth-message', 'Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión.');
      else { await syncSession(result.data.session); toast('Bienvenido a tu garage.'); }
    } catch (error) { message('auth-message', errorText(error), true); }
    finally { authBusy = false; updateAuthControls(); $('auth-submit').textContent = authMode === 'signup' ? 'Crear mi cuenta ↗' : 'Entrar a mi garage ↗'; }
  }
  function updateButtons() {
    $('save-button').disabled = !user || !account.canAddVehicle || analyzing || saving;
    $('save-button').textContent = saving ? 'Guardando…' : 'Guardar vehículo ↗';
    $('ai-button').disabled = !user || analyzing;
    $('ai-button').textContent = analyzing ? 'Preparando tu orientación…' : account.canUseAi ? 'Generar orientación con IA ✦' : 'Conocer la IA de Premium ✦';
  }
  function renderAccount() {
    $('plan-badge').textContent = account.isPremium ? 'Premium activo' : 'Plan gratuito';
    $('plan-description').textContent = account.isPremium ? 'Tu colección completa, modelos exclusivos y orientación con IA.' : 'Hasta 2 vehículos. Amplía tu garage y accede a la IA con Premium.';
    $('vehicle-usage').textContent = account.isPremium ? `${account.vehicleCount} ${account.vehicleCount === 1 ? 'vehículo' : 'vehículos'} · Sin límite de cantidad` : `${account.vehicleCount} de 2 vehículos utilizados`;
    $('upgrade-button').hidden = account.isPremium;
    updateButtons(); updateModels(true);
  }
  async function refreshGarage(version = sessionVersion) {
    try {
      const [nextAccount, data] = await Promise.all([api('account'), api('vehicles')]);
      if (version !== sessionVersion || !user) return;
      account = nextAccount; renderAccount(); renderVehicles(data.vehicles); message('account-message');
    } catch (error) {
      if (version !== sessionVersion) return;
      account = emptyAccount(); updateButtons();
      $('vehicle-usage').textContent = 'No fue posible cargar tu colección.';
      message('account-message', errorText(error), true);
    }
  }
  async function syncSession(session) {
    const nextUser = session?.user || null;
    if (user?.id === nextUser?.id) return;
    const version = ++sessionVersion;
    user = nextUser; account = emptyAccount(); invalidateReport();
    $('vehicle-form').reset(); $('mileage').setCustomValidity(''); resetSelect('brand', 'Selecciona tipo…'); resetSelect('model', 'Selecciona marca…'); resetSelect('year', 'Selecciona modelo…');
    $('vehicle-list').replaceChildren(); message('account-message'); message('save-message');
    $('login-section').hidden = Boolean(user); $('app-section').hidden = !user;
    $('nav-account').textContent = user ? 'Mi garage ↗' : 'Entrar ↗';
    $('garage-intro').textContent = user ? 'Tus vehículos, tus próximos kilómetros.' : 'Crea una cuenta o vuelve a la tuya para empezar.';
    $('feedback-account').textContent = user ? `Enviarás desde ${user.email || 'tu cuenta'}.` : 'Inicia sesión para enviar. Conservaremos lo que escribas mientras ingresas.';
    updateButtons();
    if (user) {
      $('plan-badge').textContent = 'Cargando cuenta…'; $('plan-description').textContent = ''; $('vehicle-usage').textContent = 'Consultando tu colección…';
      await refreshGarage(version);
      if (version !== sessionVersion) return;
      if (new URL(location.href).searchParams.get('subscription') === 'return') {
        try { await api('subscription/sync', { method: 'POST' }); await refreshGarage(version); toast('Estado de la suscripción actualizado.'); }
        catch (error) { message('account-message', errorText(error), true); }
        const url = new URL(location.href); url.searchParams.delete('subscription'); history.replaceState({}, '', url);
      }
    }
  }
  function resetSelect(id, placeholder) {
    $(id).replaceChildren(new Option(placeholder, '')); $(id).disabled = true;
  }
  function updateBrands() {
    resetSelect('brand', 'Selecciona marca…'); resetSelect('model', 'Selecciona marca…'); resetSelect('year', 'Selecciona modelo…');
    Object.keys(catalog[vehicleType()] || {}).sort().forEach(brand => $('brand').add(new Option(brand, brand)));
    $('brand').disabled = !vehicleType(); catalogUI.renderInfo($('vehicle-year-note'), null); invalidateReport();
  }
  function updateModels(preserve = false) {
    const previous = preserve ? $('model').value : '';
    resetSelect('model', 'Selecciona modelo…');
    const models = catalog[vehicleType()]?.[$('brand').value] || {};
    Object.keys(models).sort().forEach(model => {
      const special = premiumKeys.has(vehicleKey(vehicleType(), $('brand').value, model));
      const option = new Option(model + (special ? ' · Requiere Premium' : ''), model);
      option.disabled = special && !account.isPremium; $('model').add(option);
    });
    $('model').disabled = !$('brand').value;
    if (previous && [...$('model').options].some(o => o.value === previous && !o.disabled)) $('model').value = previous;
    else { resetSelect('year', 'Selecciona modelo…'); catalogUI.renderInfo($('vehicle-year-note'), null); invalidateReport(); }
  }
  function updateYears() {
    resetSelect('year', 'Selecciona año…');
    const model = catalog[vehicleType()]?.[$('brand').value]?.[$('model').value];
    if (model) { for (const year of rules.yearsFor(model)) $('year').add(new Option(year, year)); $('year').disabled = false; }
    catalogUI.renderInfo($('vehicle-year-note'), model);
    invalidateReport();
  }
  function invalidateReport() {
    ++analysisVersion; analyzing = false;
    $('ai-response').replaceChildren(); $('ai-response').removeAttribute('aria-busy'); $('ai-response-container').hidden = true; $('report-empty').hidden = false;
    message('save-message'); updateButtons();
  }
  function readVehicle() {
    if (!vehicleType() || !$('brand').value || !$('model').value || !$('year').value) throw new Error('Selecciona tipo, marca, modelo y año del vehículo.');
    if (!$('vehicle-form').reportValidity()) return null;
    const mileage = rules.parseMileage($('mileage').value);
    const info = rules.modelInfo(catalog, vehicleType(), $('brand').value, $('model').value);
    if (!rules.yearsFor(info).includes(Number($('year').value))) throw new Error('Selecciona un año habilitado para este modelo.');
    if (!Number.isInteger(mileage) || mileage < 0 || mileage > 999999) throw new Error('Ingresa un kilometraje entre 0 y 999.999.');
    return { type: vehicleType(), brand: $('brand').value, model: $('model').value, year: Number($('year').value), mileage, customQuery: $('customQuery').value.trim() };
  }
  function renderReport(text) {
    const labels = { ESTADO: ['Estado general', ''], CRITICO: ['Puntos críticos', 'critical'], MANTENIMIENTO: ['Mantenimiento', 'maintenance'] };
    const pieces = text && typeof text === 'object'
      ? [['', 'ESTADO', text.estado], ['', 'CRITICO', text.critico.map(item => '- ' + item).join('\n')], ['', 'MANTENIMIENTO', text.mantenimiento.map(item => '- ' + item).join('\n')]]
      : [...String(text || '').matchAll(/\[(ESTADO|CRITICO|MANTENIMIENTO)\]([\s\S]*?)(?=\[(?:ESTADO|CRITICO|MANTENIMIENTO)\]|$)/g)];
    $('ai-response').replaceChildren();
    const append = (title, content, variant) => {
      const card = document.createElement('article'); card.className = 'report-card ' + variant;
      const heading = document.createElement('h4'); heading.textContent = title;
      const paragraph = document.createElement('p'); paragraph.textContent = content.trim();
      card.append(heading, paragraph); $('ai-response').append(card);
    };
    if (pieces.length) pieces.forEach(([, key, content]) => append(labels[key][0], content, labels[key][1]));
    else append('Orientación con IA', text || 'No se recibió contenido. Vuelve a intentarlo.', '');
    const note = document.createElement('p'); note.className = 'micro'; note.textContent = 'Orientación generada con IA. Puede contener errores y no sustituye una inspección mecánica.'; $('ai-response').append(note);
  }
  async function analyze(event) {
    event.preventDefault(); if (analyzing || !user) return;
    if (!account.canUseAi) { toast('La orientación con IA está incluida en Premium.'); $('planes').scrollIntoView(); return; }
    let vehicle; try { vehicle = readVehicle(); } catch (error) { message('save-message', errorText(error), true); return; }
    if (!vehicle) return;
    const version = ++analysisVersion, identity = sessionVersion;
    analyzing = true; updateButtons(); message('save-message');
    $('report-empty').hidden = true; $('ai-response-container').hidden = false;
    $('ai-response').textContent = 'Preparando una orientación para tu vehículo…'; $('ai-response').setAttribute('aria-busy', 'true');
    try {
      const data = await api('analizar-vehiculo', { method: 'POST', body: vehicle });
      if (version === analysisVersion && identity === sessionVersion) renderReport(data.report || data.result);
    } catch (error) {
      if (version === analysisVersion && identity === sessionVersion) { $('ai-response').textContent = errorText(error); }
    } finally { if (version === analysisVersion) { analyzing = false; updateButtons(); $('ai-response').removeAttribute('aria-busy'); } }
  }
  async function saveVehicle() {
    if (!user || saving || analyzing || !account.canAddVehicle) return;
    const identity = sessionVersion;
    try {
      const vehicle = readVehicle(); if (!vehicle) return;
      saving = true; updateButtons(); message('save-message');
      await api('vehicles', { method: 'POST', body: vehicle });
      if (identity !== sessionVersion) return;
      await refreshGarage(identity);
      message('save-message', 'Vehículo guardado en tu colección.'); toast('Tu vehículo ya está en el garage.');
    } catch (error) { if (identity === sessionVersion) message('save-message', errorText(error), true); }
    finally { saving = false; updateButtons(); }
  }
  function renderVehicles(vehicles) {
    $('vehicle-list').replaceChildren();
    if (!vehicles.length) {
      const item = document.createElement('li'); item.className = 'empty-collection'; item.textContent = 'Tu colección empieza con el primer vehículo. Completa los datos y guárdalo.'; $('vehicle-list').append(item); return;
    }
    vehicles.forEach(vehicle => {
      const item = document.createElement('li'); const details = document.createElement('div');
      const brand = document.createElement('span'); brand.className = 'vehicle-brand'; brand.textContent = vehicle.brand;
      const name = document.createElement('strong'); name.className = 'vehicle-name'; name.textContent = vehicle.model;
      const meta = document.createElement('span'); meta.className = 'vehicle-meta'; meta.textContent = `${vehicle.year} · ${vehicle.type === 'Moto' ? 'Motocicleta' : 'Automóvil'}`;
      const km = document.createElement('span'); km.className = 'vehicle-km'; km.textContent = Number(vehicle.mileage).toLocaleString('es-CL') + ' KM';
      details.append(brand, name, meta); item.append(details, km); $('vehicle-list').append(item);
    });
  }
  async function upgrade() {
    if (checkoutBusy) return;
    if (!user) { setAuthMode('login'); $('garage').scrollIntoView(); toast('Primero inicia sesión o crea tu cuenta gratuita.'); return; }
    if (account.isPremium) { $('garage').scrollIntoView(); toast('Tu cuenta ya tiene Premium activo.'); return; }
    if (!config.billingConfigured) { toast('Las suscripciones todavía no están habilitadas. Puedes consultar al equipo desde Hablemos.'); return; }
    const identity = sessionVersion;
    checkoutBusy = true; $('upgrade-button').disabled = true; $('premium-cta').disabled = true;
    try {
      const data = await api('subscription/checkout', { method: 'POST' });
      if (identity !== sessionVersion) return;
      if (data.active) { await refreshGarage(); toast('Premium está activo en tu cuenta.'); }
      else { const url = new URL(data.checkoutUrl); if (url.protocol !== 'https:') throw new Error('El enlace de pago no es válido.'); location.assign(url.href); }
    } catch (error) { toast(errorText(error)); }
    finally { checkoutBusy = false; $('upgrade-button').disabled = false; $('premium-cta').disabled = false; }
  }
  async function sendFeedback(event) {
    event.preventDefault();
    if (!user) { message('feedback-status', 'Inicia sesión para enviar tu mensaje. Tu borrador sigue aquí.', true); setAuthMode('login'); $('garage').scrollIntoView(); return; }
    if ($('feedback-submit').disabled) return;
    const identity = sessionVersion;
    $('feedback-submit').disabled = true; $('feedback-submit').textContent = 'Enviando…'; message('feedback-status');
    try {
      const data = await api('feedback', { method: 'POST', body: { type: $('feedback-type').value, subject: $('feedback-subject').value.trim(), message: $('feedback-message').value.trim(), consent: $('feedback-consent').checked } });
      if (identity !== sessionVersion) return;
      $('feedback-form').reset(); $('feedback-counter').textContent = '0 / 2000';
      message('feedback-status', `Recibimos tu mensaje. Referencia: ${data.id}. Gracias por ayudarnos a mejorar.`);
    } catch (error) { if (identity === sessionVersion) message('feedback-status', errorText(error), true); }
    finally { $('feedback-submit').disabled = false; $('feedback-submit').textContent = 'Enviar mensaje ↗'; }
  }
  // Navegación y controles accesibles, disponibles incluso sin configurar la cuenta.
  $('menu-toggle').addEventListener('click', () => { const open = $('site-nav').classList.toggle('open'); $('menu-toggle').setAttribute('aria-expanded', String(open)); });
  $('site-nav').addEventListener('click', event => { if (event.target.closest('a')) { $('site-nav').classList.remove('open'); $('menu-toggle').setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('site-nav').classList.remove('open'); $('menu-toggle').setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('[data-auth-mode]').forEach(link => link.addEventListener('click', () => setAuthMode(link.dataset.authMode)));
  $('login-tab').addEventListener('click', () => setAuthMode('login')); $('signup-tab').addEventListener('click', () => setAuthMode('signup'));
  $('password-toggle').addEventListener('click', () => { const show = $('password').type === 'password'; $('password').type = show ? 'text' : 'password'; $('password-toggle').textContent = show ? 'Ocultar' : 'Mostrar'; $('password-toggle').setAttribute('aria-pressed', String(show)); $('password-toggle').setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); });
  $('auth-form').addEventListener('submit', authenticate);
  document.querySelectorAll('[data-oauth-provider]').forEach(button => button.addEventListener('click', () => authenticateWithProvider(button.dataset.oauthProvider)));
  window.addEventListener('pageshow', event => { if (event.persisted) { authBusy = false; updateAuthControls(); message('auth-message'); } });
  $('signout-button').addEventListener('click', async () => {
    $('signout-button').disabled = true;
    try { const { error } = await client.auth.signOut(); if (error) throw error; await syncSession(null); toast('Sesión cerrada.'); }
    catch (error) { message('account-message', errorText(error), true); }
    finally { $('signout-button').disabled = false; }
  });
  document.querySelectorAll('input[name="vehicleType"]').forEach(radio => radio.addEventListener('change', updateBrands));
  $('brand').addEventListener('change', () => updateModels()); $('model').addEventListener('change', updateYears);
  $('year').addEventListener('change', invalidateReport); $('customQuery').addEventListener('input', invalidateReport);
  catalogUI.bindMileage($('mileage'));
  $('mileage').addEventListener('input', invalidateReport);
  $('vehicle-form').addEventListener('submit', analyze); $('save-button').addEventListener('click', saveVehicle);
  $('upgrade-button').addEventListener('click', upgrade); $('premium-cta').addEventListener('click', upgrade);
  $('feedback-form').addEventListener('submit', sendFeedback); $('feedback-message').addEventListener('input', () => { $('feedback-counter').textContent = `${$('feedback-message').value.length} / 2000`; });
  $('privacy-open').addEventListener('click', () => $('privacy-dialog').showModal()); $('privacy-close').addEventListener('click', () => $('privacy-dialog').close());
  $('copyright-year').textContent = new Date().getFullYear();
  const examples = { estado: ['01', 'Una visión general.', 'Un resumen orientativo basado en la edad del vehículo, el kilometraje y los síntomas que ingreses.'], critico: ['02', 'Qué conviene revisar.', 'Posibles puntos de atención para conversar con un mecánico. Son hipótesis que requieren una revisión presencial, no averías confirmadas.'], mantenimiento: ['03', 'Prepara el siguiente paso.', 'Sugerencias de comprobaciones, fluidos y componentes que podrían necesitar atención, según los datos que compartes.'] };
  const tabs = [...document.querySelectorAll('[data-example]')];
  function selectExample(tab) {
    tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
    const example = examples[tab.dataset.example]; $('example-icon').textContent = example[0]; $('example-title').textContent = example[1]; $('example-text').textContent = example[2]; $('example-panel').setAttribute('aria-labelledby', tab.id);
  }
  tabs.forEach((tab, index) => { tab.addEventListener('click', () => selectExample(tab)); tab.addEventListener('keydown', event => { let next; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; if (event.key === 'Home') next = 0; if (event.key === 'End') next = tabs.length - 1; if (next !== undefined) { event.preventDefault(); selectExample(tabs[next]); tabs[next].focus(); } }); });
  async function init() {
    restoreFeedbackDraft();
    try {
      const configResponse = await fetch('/api/public-config');
      config = await configResponse.json();
      if (!configResponse.ok) throw Object.assign(new Error(config.error), { code: config.code });
      if (!window.supabase) throw new Error('No se pudo cargar el acceso. Comprueba el archivo assets/supabase.js.');
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { flowType: 'pkce', detectSessionInUrl: false } });
      updateAuthControls();
      $('social-auth-note').textContent = config.socialProviders?.length
        ? 'Usa tu cuenta de Google, Microsoft o Apple para continuar.'
        : config.socialProvidersStatus === 'unavailable' ? 'No pudimos comprobar estos accesos. Puedes usar tu correo.' : 'Estos accesos aún no están habilitados. Puedes usar tu correo.';
      if (!config.billingConfigured) $('billing-note').textContent = 'Las suscripciones online aún no están habilitadas. Consulta al equipo desde Hablemos.';
      // Se difiere el trabajo asíncrono fuera del callback de Supabase Auth.
      client.auth.onAuthStateChange((_event, session) => { setTimeout(() => { syncSession(session).catch(error => message('account-message', errorText(error), true)); }, 0); });
      if (oauthCallback.active) {
        authBusy = true; updateAuthControls();
        try { await auth.complete(client, oauthCallback); }
        catch (error) { message('auth-message', auth.errorText(error), true); }
        finally { authBusy = false; updateAuthControls(); }
      }
      const { data, error } = await client.auth.getSession(); if (error) throw error;
      await syncSession(data.session);
      if (oauthCallback.active) $('garage').scrollIntoView();
    } catch (error) {
      message('config-message', errorText(error), true);
      $('social-auth-note').textContent = 'Estos accesos aún no están habilitados.';
      updateAuthControls();
      if (oauthCallback.active) $('garage').scrollIntoView();
    }
  }
  init();
})();
