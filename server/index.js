const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- APPLICATIONS API ---

// Get all applications
app.get('/api/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM applications ORDER BY dateApplied DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check status by email
app.get('/api/applications/status/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const result = await pool.query('SELECT * FROM applications WHERE LOWER(emailAddress) = LOWER($1)', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit new application
app.post('/api/applications', async (req, res) => {
  try {
    const data = req.body;
    
    // Generate ID based on current count
    const countRes = await pool.query('SELECT COUNT(*) as count FROM applications');
    const count = parseInt(countRes.rows[0].count);
    
    const id = `APP-${String(count + 1).padStart(3, '0')}`;
    const dateApplied = new Date().toISOString().split('T')[0];
    const status = 'Pending';
    const inspectionNotes = '';
    const approvalDate = '';
    
    const query = `
      INSERT INTO applications (
        id, category, organizationName, applicantName, position, phoneNumber, alternativePhoneNumber,
        emailAddress, residentialAddress, isRegistered, registrationNumber, briefProfile,
        programmeName, venue, lga, community, commencementDate, closingDate, duration, dailyTime,
        status, dateApplied, approvalDate, inspectionNotes, facilityConditions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    `;
    
    const params = [
      id, data.category, data.organizationName, data.applicantName, data.position, data.phoneNumber, data.alternativePhoneNumber,
      data.emailAddress, data.residentialAddress, data.isRegistered, data.registrationNumber, data.briefProfile,
      data.programmeName, data.venue, data.lga, data.community, data.commencementDate, data.closingDate, data.duration, data.dailyTime,
      status, dateApplied, approvalDate, inspectionNotes, data.facilityConditions
    ];
    
    await pool.query(query, params);
    res.status(201).json({ id, message: 'Application submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update application status
app.put('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, inspectionNotes } = req.body;
    const approvalDate = new Date().toISOString().split('T')[0];

    const query = `UPDATE applications SET status = $1, inspectionNotes = $2, approvalDate = $3 WHERE id = $4`;
    await pool.query(query, [status, inspectionNotes, approvalDate, id]);
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH & STAFF API ---

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM staff WHERE email = $1 AND password = $2', [email, password]);
    
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    
    const row = result.rows[0];
    if (row.status !== 'Active') return res.status(403).json({ error: 'Account is inactive' });
    
    // Don't send the password back to the client
    const { password: _, ...user } = row;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all staff
app.get('/api/staff', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, status, dateAdded FROM staff');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new staff
app.post('/api/staff', async (req, res) => {
  try {
    const { name, email, role, status, password } = req.body;
    
    const countRes = await pool.query('SELECT COUNT(*) as count FROM staff');
    const count = parseInt(countRes.rows[0].count);
    
    // Generate unique ID based on timestamp and count to avoid duplicates
    const id = `STF-${Date.now()}-${String(count + 1).padStart(3, '0')}`;
    const dateAdded = new Date().toISOString().split('T')[0];
    
    await pool.query(
      `INSERT INTO staff (id, name, email, role, status, dateAdded, password) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
      [id, name, email, role, status, dateAdded, password]
    );
    
    res.status(201).json({ id, message: 'Staff added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update staff (Full Edit)
app.put('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, password } = req.body;
    
    // First get existing staff to protect Super Admin role
    const getRes = await pool.query('SELECT role FROM staff WHERE id = $1', [id]);
    
    if (getRes.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    const row = getRes.rows[0];
    
    // Prevent changing a Super Admin's role or status
    const finalRole = row.role === 'Super Admin' ? 'Super Admin' : (role || row.role);
    const finalStatus = row.role === 'Super Admin' ? 'Active' : status;
    
    let query = `UPDATE staff SET name = $1, email = $2, role = $3, status = $4`;
    let params = [name, email, finalRole, finalStatus];
    let paramIndex = 5;
    
    if (password && password.trim() !== '') {
      query += `, password = $${paramIndex}`;
      params.push(password);
      paramIndex++;
    }
    
    query += ` WHERE id = $${paramIndex}`;
    params.push(id);
    
    await pool.query(query, params);
    res.json({ message: 'Staff updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete staff
app.delete('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting Super Admin
    const query = `DELETE FROM staff WHERE id = $1 AND role != 'Super Admin'`;
    const result = await pool.query(query, [id]);
    
    if (result.rowCount === 0) {
       // Could mean not found or was super admin
       return res.status(403).json({ error: 'Cannot delete Super Admin or staff not found' });
    }
    
    res.json({ message: 'Staff deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all route to serve the React app
app.use((req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
