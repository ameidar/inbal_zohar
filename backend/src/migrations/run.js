const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function runMigrations() {
  console.log('Running migrations...');
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Running ${file}...`);
    await pool.query(sql);
  }
  console.log('Migrations done.');
}

runMigrations().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
