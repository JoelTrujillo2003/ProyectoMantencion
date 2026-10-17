/* OAuth con Supabase. Compartido con las pruebas de Node; no contiene credenciales. */
globalThis.GarageAuth = (() => {
  const providers = Object.freeze({ google: 'Google', azure: 'Microsoft', apple: 'Apple' });
  const supported = provider => Object.hasOwn(providers, provider);
  function callbackUrl(origin) {
    const base = new URL(origin);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Origen de acceso inválido.');
    return base.origin + '/?auth=callback';
  }
  function requestFor(provider, origin) {
    if (!supported(provider)) throw new Error('Proveedor de acceso no reconocido.');
    return { provider, options: {
      redirectTo: callbackUrl(origin), skipBrowserRedirect: true,
      ...(provider === 'azure' ? { scopes: 'email' } : {}),
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {})
    } };
  }
  function validateAuthorizeUrl(value, supabaseUrl, provider) {
    const target = new URL(value), base = new URL(supabaseUrl);
    if (target.origin !== base.origin || target.pathname !== '/auth/v1/authorize' ||
        target.username || target.password || target.searchParams.get('provider') !== provider ||
        !['http:', 'https:'].includes(target.protocol)) throw new Error('No se pudo preparar un enlace de acceso válido.');
    return target.href;
  }
  async function start(client, provider, origin, supabaseUrl) {
    const request = requestFor(provider, origin);
    const { data, error } = await client.auth.signInWithOAuth(request);
    if (error) throw error;
    if (!data?.url) throw new Error('No se recibió el enlace de acceso. Vuelve a intentar.');
    const target = new URL(validateAuthorizeUrl(data.url, supabaseUrl, provider));
    if (target.searchParams.get('redirect_to') !== request.options.redirectTo) throw new Error('El retorno del acceso no coincide con esta aplicación.');
    return target.href;
  }
  function errorText(error) {
    const code = error?.code || error?.error_code || '';
    if (code === 'access_denied' || /access_denied|user.?cancel/i.test(error?.message || '')) return 'El acceso fue cancelado. Puedes volver a intentarlo o usar tu correo.';
    if (/provider.*(disabled|not enabled|not supported)|unsupported.provider/i.test(error?.message || '')) return 'Este proveedor todavía no está habilitado. Puedes ingresar con tu correo.';
    if (/code.verifier|pkce|flow_state|code.*expired/i.test(code + ' ' + (error?.message || ''))) return 'El enlace de acceso venció o se abrió en otro navegador. Inicia el acceso nuevamente desde esta página.';
    if (/fetch|network/i.test(error?.message || '')) return 'No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo nuevamente.';
    return 'No se pudo completar el acceso externo. Inténtalo nuevamente o ingresa con tu correo.';
  }
  function readCallback(href) {
    const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
    const hasError = ['error','error_code','error_description'].some(key => url.searchParams.has(key) || hash.has(key));
    const error = hasError ? { code: url.searchParams.get('error_code') || hash.get('error_code') || url.searchParams.get('error') || hash.get('error'), message: url.searchParams.get('error') || hash.get('error') || '' } : null;
    const legacy = hash.has('access_token') || hash.has('refresh_token');
    const code = url.searchParams.get('code');
    const active = Boolean(code || hasError || legacy || url.searchParams.get('auth') === 'callback');
    for (const key of ['code','auth','error','error_code','error_description','error_uri','state']) url.searchParams.delete(key);
    if (active) url.hash = 'garage';
    return { active, code, error, legacy, cleanUrl: url.pathname + url.search + url.hash };
  }
  async function complete(client, callback) {
    if (callback.error) throw callback.error;
    if (callback.legacy) throw { code: 'pkce_link_required' };
    if (!callback.code) {
      if (callback.active) throw { code: 'pkce_missing_code' };
      return null;
    }
    const { data, error } = await client.auth.exchangeCodeForSession(callback.code);
    if (error) throw error;
    if (!data?.session) throw { code: 'pkce_missing_session' };
    return data.session;
  }
  return { providers, supported, callbackUrl, requestFor, validateAuthorizeUrl, start, readCallback, complete, errorText };
})();
