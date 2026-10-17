/* Reglas compartidas por el navegador y Node. Sin servicios externos. */
globalThis.GarageVehicleRules = (() => {
  const currentYear = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Santiago' }).format(new Date()));
  const own = (object, key) => object && Object.hasOwn(object, key) ? object[key] : undefined;
  const modelInfo = (catalog, type, brand, model) => own(own(own(catalog, type), brand), model);
  function yearsFor(info, now = currentYear()) {
    if (!info) return [];
    if (info.years) return [...new Set(info.years)].filter(y => Number.isInteger(y) && y <= now).sort((a, b) => b - a);
    const years = [];
    for (let y = Math.min(info.maxYear, now); y >= info.minYear; y--) years.push(y);
    return years;
  }
  function parseMileage(value) {
    if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 999999 ? value : NaN;
    if (typeof value !== 'string') return NaN;
    const input = value.trim();
    if (!/^(?:\d{1,6}|[1-9]\d{0,2}\.\d{3})$/.test(input)) return NaN;
    const number = Number(input.replace('.', ''));
    return number <= 999999 ? number : NaN;
  }
  function formatMileage(value) {
    const number = parseMileage(value);
    return Number.isNaN(number) ? '' : String(number).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function editMileage(input) {
    const raw = String(input);
    // No convertir negativos, decimales con coma, letras ni valores superiores al máximo.
    if (!/^[\d.]*$/.test(raw) || raw.replace(/\./g, '').length > 6) return null;
    const digits = raw.replace(/\./g, '');
    return digits ? formatMileage(Number(digits)) : '';
  }
  return { currentYear, modelInfo, yearsFor, parseMileage, formatMileage, editMileage };
})();
