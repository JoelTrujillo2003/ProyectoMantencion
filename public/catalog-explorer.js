/* Exploración pública: no inicia sesión, no guarda ni simula una respuesta de IA. */
(() => {
  const $ = id => document.getElementById(id);
  const rules = globalThis.GarageVehicleRules;
  const catalog = window.vehicleDB;
  const premium = new Set(window.premiumVehicleCatalog.map(v => [v.type, v.brand, v.model].join('\0')));
  function note(info) {
    if (!info) return 'Selecciona un modelo para ver sus años y el acceso necesario.';
    const years = rules.yearsFor(info);
    const range = years.length === 1 ? String(years[0]) : `${years.at(-1)}–${years[0]}`;
    if (info.yearBasis === 'catalog_snapshot') return `Año habilitado: ${range}. El modelo figura en el catálogo chileno consultado en 2026. Su historial de años aún está en revisión; esto no significa que haya llegado en 2026. Si falta tu año, solicita su incorporación.`;
    if (info.yearBasis === 'local_launch') return `Años habilitados: ${range}. Hay una publicación del lanzamiento chileno. Confirma el año de fabricación y la versión con el padrón de tu vehículo.`;
    if (info.yearBasis === 'documented_year') return `Años documentados en la fuente local: ${range}. Si falta tu año, solicita su incorporación.`;
    return `Rango referencial: ${range}. La fecha exacta de llegada a Chile aún no está certificada en este catálogo. Confirma año y versión con tu padrón.`;
  }
  function renderInfo(element, info) {
    element.replaceChildren(document.createTextNode(note(info)));
    if (info?.source) {
      const link = document.createElement('a'); link.href = info.source; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = ' Consultar fuente chilena ↗'; element.append(link);
    }
  }
  function bindMileage(input) {
    const feedback = document.createElement('small');
    feedback.id = input.id + '-validation'; feedback.setAttribute('aria-live', 'polite');
    feedback.style.color = '#a33f3f'; input.after(feedback);
    input.setAttribute('aria-describedby', ((input.getAttribute('aria-describedby') || '') + ' ' + feedback.id).trim());
    input.addEventListener('input', () => {
      const caret = input.selectionStart ?? input.value.length;
      const digitsBefore = input.value.slice(0, caret).replace(/\./g, '').length;
      const formatted = rules.editMileage(input.value);
      input.setCustomValidity(formatted === null ? 'Usa solo números enteros de 0 a 999.999 km.' : '');
      feedback.textContent = formatted === null ? 'Usa solo números enteros de 0 a 999.999 km.' : '';
      if (formatted === null) return;
      input.value = formatted;
      let count = 0, position = 0;
      while (position < formatted.length && count < digitsBefore) { if (/\d/.test(formatted[position])) count++; position++; }
      input.setSelectionRange(position, position);
    });
  }
  window.GarageCatalogUI = { renderInfo, bindMileage };
  const summary = Object.entries(catalog).map(([type, brands]) => `${Object.keys(brands).length} marcas de ${type === 'Auto' ? 'autos' : 'motos'} · ${Object.values(brands).reduce((n, models) => n + Object.keys(models).length, 0)} modelos`);
  $('catalog-count').textContent = summary.join(' / ');
  $('premium-count').textContent = `${premium.size} modelos requieren Premium para guardar. Puedes explorarlos sin pagar.`;
  const type = $('explore-type'), brand = $('explore-brand'), model = $('explore-model'), year = $('explore-year');
  function reset(select, text) { select.replaceChildren(new Option(text, '')); select.disabled = true; }
  function showModels() {
    reset(model, 'Selecciona modelo…'); reset(year, 'Selecciona modelo…');
    for (const name of Object.keys(catalog[type.value]?.[brand.value] || {}).sort((a,b)=>a.localeCompare(b,'es'))) {
      const special = premium.has([type.value,brand.value,name].join('\0'));
      model.add(new Option(name + (special ? ' · Requiere Premium' : ''), name));
    }
    model.disabled = !brand.value; showYears();
  }
  function showYears() {
    reset(year, 'Selecciona año…');
    const info = rules.modelInfo(catalog, type.value, brand.value, model.value);
    for (const y of rules.yearsFor(info)) year.add(new Option(y,y));
    year.disabled = !info;
    renderInfo($('explore-info'), info);
    $('explore-plan').textContent = info ? (premium.has([type.value,brand.value,model.value].join('\0')) ? 'Guardar este modelo requiere el plan Premium.' : 'Disponible en Free y Premium. Free permite hasta 2 vehículos.') : '';
  }
  function showBrands() {
    reset(brand, 'Selecciona marca…');
    for (const name of Object.keys(catalog[type.value] || {}).sort((a,b)=>a.localeCompare(b,'es'))) brand.add(new Option(name,name));
    brand.disabled = !type.value; showModels();
  }
  type.addEventListener('change', showBrands); brand.addEventListener('change', showModels); model.addEventListener('change', showYears);
  bindMileage($('explore-mileage'));
  $('catalog-preview-form').addEventListener('submit', event => { event.preventDefault(); });
  showBrands();
})();
