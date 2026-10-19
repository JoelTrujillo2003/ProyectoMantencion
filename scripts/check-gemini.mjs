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
  // Solo se imprimen los errores públicos ya filtrados por la aplicación.
  console.error(JSON.stringify({
    check: 'gemini', ok: false, elapsedMs: Date.now() - started,
    code: error.code || 'check_failed', status: error.status || 500,
    message: error.code ? error.message : 'No se pudo completar la comprobación de Gemini.'
  }));
  process.exitCode = 1;
}
