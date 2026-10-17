const PROVIDERS = ['google', 'azure', 'apple'];
export function enabledProviders(settings) {
  return PROVIDERS.filter(provider => settings?.external?.[provider] === true);
}
export async function getSocialProviders(url, anonKey, request = fetch) {
  try {
    const response = await request(url.replace(/\/$/, '') + '/auth/v1/settings', {
      headers: { apikey: anonKey }, signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) return { socialProviders: [], socialProvidersStatus: 'unavailable' };
    return { socialProviders: enabledProviders(await response.json()), socialProvidersStatus: 'known' };
  } catch {
    // El fallo de descubrimiento no bloquea el acceso existente con correo.
    return { socialProviders: [], socialProvidersStatus: 'unavailable' };
  }
}
