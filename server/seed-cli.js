// npm run seed -- --reset   → borra y vuelve a cargar los datos de demostración.
import { config } from './config.js';
import { openDb, dropAll } from './db.js';
import { seed } from './seed.js';

const db = openDb(config.dbFile);
const hasData = db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0;
if (hasData && !process.argv.includes('--reset')) {
  console.log('La base de datos ya tiene datos. Use "npm run seed -- --reset" para reemplazarlos.');
  process.exit(0);
}
dropAll(db);
seed(db, { dataDir: config.dataDir });
console.log('Datos de demostración cargados.');
