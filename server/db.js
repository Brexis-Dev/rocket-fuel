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

    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_specs (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        plan_file_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
        is_reference BOOLEAN DEFAULT FALSE,
        total_sqft_conditioned INTEGER,
        total_sqft_unconditioned INTEGER,
        bedrooms INTEGER,
        bathrooms DECIMAL(4,1),
        exterior_doors INTEGER,
        interior_doors INTEGER,
        windows INTEGER,
        cabinet_linear_feet DECIMAL(8,2),
        countertop_sqft DECIMAL(8,2),
        garage_type VARCHAR(100),
        roof_type VARCHAR(100),
        roof_pitch VARCHAR(50),
        foundation_type VARCHAR(100),
        stories INTEGER,
        finish_notes TEXT,
        raw_extracted JSONB,
        confirmed BOOLEAN DEFAULT FALSE,
        confirmed_by INTEGER REFERENCES users(id),
        confirmed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bid_documents (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50),
        file_size INTEGER,
        is_reference BOOLEAN DEFAULT FALSE,
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bid_line_items (
        id SERIAL PRIMARY KEY,
        bid_document_id INTEGER REFERENCES bid_documents(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id),
        vendor_id INTEGER REFERENCES vendors(id),
        trade VARCHAR(100),
        description TEXT,
        quantity DECIMAL(12,4),
        unit VARCHAR(50),
        unit_price DECIMAL(12,2),
        line_total DECIMAL(12,2),
        sort_order INTEGER,
        flagged BOOLEAN DEFAULT FALSE,
        flag_reason TEXT,
        confirmed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bid_summaries (
        id SERIAL PRIMARY KEY,
        bid_document_id INTEGER REFERENCES bid_documents(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id),
        vendor_id INTEGER REFERENCES vendors(id),
        bid_date DATE,
        bid_expiration_date DATE,
        trade VARCHAR(100),
        subtotal DECIMAL(12,2),
        tax DECIMAL(12,2),
        grand_total DECIMAL(12,2),
        exclusions TEXT,
        clarifications TEXT,
        notes TEXT,
        completeness_score INTEGER,
        is_reference BOOLEAN DEFAULT FALSE,
        confirmed BOOLEAN DEFAULT FALSE,
        confirmed_by INTEGER REFERENCES users(id),
        confirmed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pricing_model (
        id SERIAL PRIMARY KEY,
        model_version VARCHAR(20) NOT NULL,
        trade VARCHAR(100) NOT NULL,
        cost_per_sqft DECIMAL(10,4),
        cost_per_unit DECIMAL(10,4),
        unit_type VARCHAR(100),
        pct_of_total DECIMAL(6,4),
        sample_count INTEGER DEFAULT 1,
        reference_plan_id INTEGER REFERENCES plan_specs(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS model_versions (
        id SERIAL PRIMARY KEY,
        version VARCHAR(20) NOT NULL,
        notes TEXT,
        snapshot JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bid_comparisons (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        bid_document_id INTEGER REFERENCES bid_documents(id),
        model_version VARCHAR(20),
        baseline_total DECIMAL(12,2),
        bid_total DECIMAL(12,2),
        variance_amount DECIMAL(12,2),
        variance_pct DECIMAL(8,4),
        completeness_score INTEGER,
        line_item_results JSONB,
        recommended BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS extraction_log (
        id SERIAL PRIMARY KEY,
        source_type VARCHAR(50),
        source_id INTEGER,
        document_type VARCHAR(50),
        raw_response TEXT,
        parsed_result JSONB,
        confidence_score INTEGER,
        corrections JSONB,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
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
