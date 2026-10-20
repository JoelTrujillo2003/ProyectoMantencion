import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['001_freemium.sql', '002_feedback.sql', '003_catalog_chile.sql', '004_maintenance_records.sql'];
const chunks = ['-- Garage Premium Moderno · Hito 2',
  '-- Crear desde cero en un proyecto Supabase NUEVO con el esquema auth preinstalado.',
  '-- No ejecutar este archivo combinado sobre la base de producción.\n'];
for (const name of names) {
  chunks.push(`\n-- ===== ${name} =====\n`);
  chunks.push(await fs.readFile(path.join(root, 'supabase', 'migrations', name), 'utf8'));
}
const target = path.join(root, 'db', 'crear_desde_cero.sql');
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, chunks.join('\n'), 'utf8');
console.log(`Generado ${target}`);
