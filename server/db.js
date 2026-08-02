const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.qubqqqotwgkqsdnyveps:%40BelloSummer2026!!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database on Supabase.');
});

const initializeDatabase = async () => {
  try {
    // Create applications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        category TEXT,
        organizationName TEXT,
        applicantName TEXT,
        position TEXT,
        phoneNumber TEXT,
        alternativePhoneNumber TEXT,
        emailAddress TEXT,
        residentialAddress TEXT,
        isRegistered TEXT,
        registrationNumber TEXT,
        briefProfile TEXT,
        programmeName TEXT,
        venue TEXT,
        lga TEXT,
        community TEXT,
        commencementDate TEXT,
        closingDate TEXT,
        duration TEXT,
        dailyTime TEXT,
        status TEXT,
        dateApplied TEXT,
        approvalDate TEXT,
        inspectionNotes TEXT,
        facilityConditions TEXT,
        educationLevel TEXT,
        expectedLearners INTEGER
      )
    `);

    // Add new columns if they don't exist
    try {
      await pool.query(`ALTER TABLE applications ADD COLUMN facilityConditions TEXT`);
    } catch (err) {}
    try {
      await pool.query(`ALTER TABLE applications ADD COLUMN educationLevel TEXT`);
    } catch (err) {}
    try {
      await pool.query(`ALTER TABLE applications ADD COLUMN expectedLearners INTEGER`);
    } catch (err) {}

    // Create settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        portalOpen BOOLEAN DEFAULT true,
        currentYear TEXT,
        signatoryName TEXT,
        signatoryTitle TEXT,
        signatureData TEXT
      )
    `);

    // Initialize settings if empty
    try {
      const settingsCountRes = await pool.query(`SELECT COUNT(*) as count FROM settings`);
      if (parseInt(settingsCountRes.rows[0].count) === 0) {
        await pool.query(`
          INSERT INTO settings (id, portalOpen, currentYear, signatoryName, signatoryTitle, signatureData)
          VALUES (1, true, '2026', 'Hon. Commissioner', 'Ministry of Education', '')
        `);
      }
    } catch (err) {
      console.error('Error initializing settings:', err);
    }

    // Create audit_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        userName TEXT,
        userRole TEXT,
        action TEXT,
        details TEXT,
        timestamp TEXT
      )
    `);

    // Create staff table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        role TEXT,
        status TEXT,
        dateAdded TEXT,
        password TEXT
      )
    `);

    // Add password if it doesn't exist
    try {
      await pool.query(`ALTER TABLE staff ADD COLUMN password TEXT`);
      await pool.query(`UPDATE staff SET password = 'password123' WHERE password IS NULL`);
      await pool.query(`UPDATE staff SET password = '@Summerclass2026!!' WHERE role = 'Super Admin'`);
    } catch (err) {
      // Ignore error if column already exists
    }

    // Enforce Super Admin credentials
    await pool.query(`
      UPDATE staff 
      SET email = 'belloolayinka1@gmail.com', password = '@Summerclass2026!!' 
      WHERE id = 'STF-001' AND role = 'Super Admin'
    `);

    // Seed initial staff
    const staffCountRes = await pool.query(`SELECT COUNT(*) as count FROM staff`);
    if (parseInt(staffCountRes.rows[0].count) === 0) {
      const insertQuery = `
        INSERT INTO staff (id, name, email, role, status, dateAdded, password) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await pool.query(insertQuery, ['STF-001', 'Admin User', 'belloolayinka1@gmail.com', 'Super Admin', 'Active', '2026-01-10', '@Summerclass2026!!']);
      await pool.query(insertQuery, ['STF-002', 'Inspector Ibrahim', 'ibrahim.insp@kwaramoe.gov.ng', 'Inspector', 'Active', '2026-02-15', 'inspector123']);
    }

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initializeDatabase();

module.exports = pool;
