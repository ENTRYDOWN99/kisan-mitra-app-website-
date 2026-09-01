require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsDir = __dirname;

async function run() {
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
            await pool.query(sql);
            console.log(`✓ Migration applied: ${file}`);
        } catch (err) {
            console.error(`✗ Migration failed: ${file}`);
            console.error(err.message);
        }
    }

    await pool.end();
    console.log('All migrations complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
