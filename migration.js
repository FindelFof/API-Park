const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'root',
    host: 'localhost',
    port: 5432,
    database: 'parkmanager',
});

async function migration() {
    try {
        // Création de la table 'users'
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

        // Création de la table 'parking_spots'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS parking_spots (
                 id SERIAL PRIMARY KEY,
                 spot_number INTEGER NOT NULL,
                 floor INTEGER NOT NULL,
                 availability BOOLEAN NOT NULL,
                 occupancy_time INTEGER,
                 user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
                );
    `);

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        pool.end();
    }
}


migration();
