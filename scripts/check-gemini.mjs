import 'dotenv/config';
import { generateReport } from '../src/ai.js';

// Comprobación manual con datos de ejemplo. No inicia sesión ni modifica la base.
const started = Date.now();
try {
  const result = await generateReport(
    { type: 'Motocicleta', brand: 'Bajaj', model: 'Pulsar RS200', year: 2026, mileage: 10000 },
    'Ejemplo de prueba: sin síntomas actuales. Quiero organizar la próxima revisión.',
    { yearBasis: 'reference', source: 'https://www.bajajauto.com/en-cl' }
  );
  console.log(JSON.stringify({
    check: 'gemini', ok: true, model: result.model, elapsedMs: Date.now() - started,
    criticalItems: result.report.critico.length, maintenanceItems: result.report.mantenimiento.length,
    report: result.report
  }));
} catch (error) {
  const secret = process.env.GEMINI_API_KEY;
  const sanitize = value => String(value || '').replaceAll(secret || '__no_key__', '[clave oculta]')
    .replace(/(?:AIza|AQ\.)[A-Za-z0-9_-]{20,}/g, '[clave oculta]').slice(0, 1200);
  const cause = error.cause;
  // Este diagnóstico es exclusivo de la terminal del administrador.
  // El endpoint público mantiene su mensaje filtrado y nunca devuelve la causa.
  console.error(JSON.stringify({
    check: 'gemini', ok: false, elapsedMs: Date.now() - started,
    code: error.code || 'check_failed', status: error.status || 500,
    message: error.code ? error.message : 'No se pudo completar la comprobación de Gemini.',
    ...(cause ? { diagnostic: { name: cause.name, status: cause.status || cause.statusCode,
      code: cause.code || cause.cause?.code, message: sanitize(cause.message) } } : {})
  }));
  process.exitCode = 1;
}
