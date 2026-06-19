const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

function query(text, params) {
  return pool.query(text, params);
}

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255),
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        trade VARCHAR(100),
        notes TEXT,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        revision VARCHAR(50),
        label VARCHAR(255),
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS distributions (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id),
        vendor_id INTEGER REFERENCES vendors(id),
        sent_by INTEGER REFERENCES users(id),
        sent_at TIMESTAMP DEFAULT NOW(),
        bid_due_date DATE,
        message TEXT,
        plan_ids INTEGER[],
        status VARCHAR(50) DEFAULT 'Pending'
      );

      CREATE TABLE IF NOT EXISTS bid_responses (
        id SERIAL PRIMARY KEY,
        distribution_id INTEGER REFERENCES distributions(id),
        response_status VARCHAR(50) DEFAULT 'Pending',
        response_date TIMESTAMP,
        bid_amount DECIMAL(12,2),
        notes TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed users if none exist
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      const hash1 = await bcrypt.hash('RocketFuel2025!', 12);
      const hash2 = await bcrypt.hash('RocketFuel2025!', 12);
      await client.query(
        `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3), ($4, $5, $6)`,
        [
          'nnagle@schaefer-homes.com', hash1, 'Nate',
          'partner@rocketfuel.com', hash2, 'Partner',
        ]
      );
      console.log('Seeded default users.');
    }

    console.log('Database initialized.');
  } finally {
    client.release();
  }
}

module.exports = { query, initDB };
