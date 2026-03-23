const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

let sqliteDb;
let db;

async function initializeDatabase() {
  try {
    sqliteDb = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    db = {
      async execute(sql, params = []) {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const rows = await sqliteDb.all(sql, params);
          return [rows];
        } else {
          const result = await sqliteDb.run(sql, params);
          return [result];
        }
      }
    };

    console.log('Connected to SQLite database securely.');

    await createTables();
    await ensureColumns();
    await createDefaultPrimarySocieties();
    await createDefaultAdmin();

  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

async function createDefaultPrimarySocieties() {
  try {
    const existing = await db.execute('SELECT id FROM primary_societies LIMIT 1');
    if (existing[0].length === 0) {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const defaultPS = [
        { id: uuidv4(), name: 'Default Society', code: 'DEFAULT', status: 'Active' },
        { id: uuidv4(), name: 'Society A', code: 'A', status: 'Active' },
        { id: uuidv4(), name: 'Society B', code: 'B', status: 'Active' }
      ];
      for (const ps of defaultPS) {
        await db.execute(`INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
          [ps.id, ps.name, ps.code, ps.status, now]);
      }
      console.log('Default primary societies created');
    }
  } catch (error) {
    console.error('Error creating default primary societies:', error.message);
  }
}

async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      fullName VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      ps VARCHAR(50) NOT NULL,
      darkMode TINYINT DEFAULT 0,
      testMode TINYINT DEFAULT 0,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS primary_societies (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS seasons (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      startDate DATE NOT NULL,
      endDate DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      description TEXT,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS market_centers (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      location VARCHAR(255),
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS farmers (
      id VARCHAR(36) PRIMARY KEY,
      farmerNumber VARCHAR(20) UNIQUE NOT NULL,
      firstName VARCHAR(50) NOT NULL,
      middleName VARCHAR(50),
      lastName VARCHAR(50) NOT NULL,
      gender VARCHAR(10),
      age INT,
      village VARCHAR(100) NOT NULL,
      phoneNumber VARCHAR(20),
      idType VARCHAR(50),
      idNumber VARCHAR(100),
      hectares DECIMAL(10,2),
      contractedVolume DECIMAL(10,2),
      seasonId VARCHAR(36),
      ps VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (seasonId) REFERENCES seasons(id)
    )`,
    `CREATE TABLE IF NOT EXISTS input_types (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL,
      unitPrice DECIMAL(10,2) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS issued_inputs (
      id VARCHAR(36) PRIMARY KEY,
      farmerId VARCHAR(36) NOT NULL,
      inputTypeId VARCHAR(36) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      totalCost DECIMAL(10,2) NOT NULL,
      issueDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (inputTypeId) REFERENCES input_types(id)
    )`,
    `CREATE TABLE IF NOT EXISTS sale_numbers (
      id VARCHAR(36) PRIMARY KEY,
      saleNumber VARCHAR(50) UNIQUE NOT NULL,
      marketCenterId VARCHAR(36) NOT NULL,
      seasonId VARCHAR(36) NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (seasonId) REFERENCES seasons(id)
    )`,
    `CREATE TABLE IF NOT EXISTS tickets (
      id VARCHAR(36) PRIMARY KEY,
      ticketNumber VARCHAR(50) UNIQUE NOT NULL,
      pcnNumber VARCHAR(50),
      farmerId VARCHAR(36) NOT NULL,
      gradeId VARCHAR(36) NOT NULL,
      marketCenterId VARCHAR(36) NOT NULL,
      saleNumberId VARCHAR(36) NOT NULL,
      grossWeight DECIMAL(10,2) NOT NULL,
      tareWeight DECIMAL(10,2) NOT NULL,
      netWeight DECIMAL(10,2) NOT NULL,
      pricePerKg DECIMAL(10,2) NOT NULL,
      totalValue DECIMAL(10,2) NOT NULL,
      captureDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (gradeId) REFERENCES grades(id),
      FOREIGN KEY (marketCenterId) REFERENCES market_centers(id),
      FOREIGN KEY (saleNumberId) REFERENCES sale_numbers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS pcns (
      id VARCHAR(36) PRIMARY KEY,
      pcnNumber VARCHAR(50) UNIQUE NOT NULL,
      saleNumber VARCHAR(100) NOT NULL,
      ps VARCHAR(50) NOT NULL,
      totalFarmers INT NOT NULL DEFAULT 0,
      totalTickets INT NOT NULL DEFAULT 0,
      totalWeight DECIMAL(10,2) NOT NULL DEFAULT 0,
      totalValue DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL,
      closedAt DATETIME,
      closedBy VARCHAR(100),
      approvedAt DATETIME,
      approvedBy VARCHAR(100),
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY,
      farmerId VARCHAR(36) NOT NULL,
      pcnId VARCHAR(36),
      tobaccoAmount DECIMAL(10,2) NOT NULL,
      inputDeduction DECIMAL(10,2) NOT NULL,
      usdBalance DECIMAL(10,2) NOT NULL DEFAULT 0,
      exchangeRate DECIMAL(10,4) NOT NULL DEFAULT 0,
      tzsGross DECIMAL(14,2) NOT NULL DEFAULT 0,
      levy DECIMAL(14,2) NOT NULL DEFAULT 0,
      adminFee DECIMAL(14,2) NOT NULL DEFAULT 0,
      totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0,
      netPayment DECIMAL(14,2) NOT NULL,
      paymentDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (pcnId) REFERENCES pcns(id)
    )`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt DATETIME NOT NULL
    )`
  ];

  for (const sql of tables) {
    try {
      await db.execute(sql);
    } catch (error) {
      console.error('Error creating table:', error.message);
    }
  }
}

async function ensureColumns() {
  const alterations = [
    "ALTER TABLE farmers ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE farmers ADD COLUMN middleName VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN gender VARCHAR(10)",
    "ALTER TABLE farmers ADD COLUMN age INT",
    "ALTER TABLE farmers ADD COLUMN hectares DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN contractedVolume DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active'",
    "ALTER TABLE farmers ADD COLUMN idType VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN idNumber VARCHAR(100)",
    "ALTER TABLE farmers ADD COLUMN seasonId VARCHAR(36)",
    "ALTER TABLE issued_inputs ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE tickets ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE tickets ADD COLUMN pcnNumber VARCHAR(50)",
    "ALTER TABLE payments ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE payments ADD COLUMN usdBalance DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN exchangeRate DECIMAL(10,4) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN tzsGross DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN levy DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN adminFee DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE payments ADD COLUMN totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0",
    "ALTER TABLE pcns ADD COLUMN closedAt DATETIME",
    "ALTER TABLE pcns ADD COLUMN closedBy VARCHAR(100)",
    "ALTER TABLE pcns ADD COLUMN approvedAt DATETIME",
    "ALTER TABLE pcns ADD COLUMN approvedBy VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN testMode TINYINT DEFAULT 0",
  ];

  for (const sql of alterations) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Error adding column:', error.message);
      }
    }
  }
}

async function createDefaultAdmin() {
  try {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminUser = {
      id: uuidv4(),
      username: 'admin',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'Supervisor',
      ps: 'All',
      darkMode: 0,
      testMode: 0,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, adminUser.username, adminUser.password, adminUser.fullName,
         adminUser.role, adminUser.ps, adminUser.darkMode, adminUser.testMode, adminUser.createdAt]);
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

initializeDatabase();

// Helper: is user a supervisor/admin?
function isSupervisor(user) {
  return user.role === 'Supervisor' || user.role === 'Admin';
}

// Auth middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.execute(
      'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?',
      [decoded.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// ─── PRIMARY SOCIETIES ───────────────────────────────────────────────────────

app.get('/api/ps', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM primary_societies ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Get PS error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/ps', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { name, code, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO primary_societies (id, name, code, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, name, code, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, code, status: status || 'Active' });
  } catch (error) {
    console.error('Create PS error:', error);
    res.status(500).json({ error: 'Error creating primary society' });
  }
});

app.put('/api/ps/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, code, status } = req.body;
    await db.execute('UPDATE primary_societies SET name=?, code=?, status=? WHERE id=?',
      [name, code, status, req.params.id]);
    res.json({ id: req.params.id, name, code, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating society' });
  }
});

app.delete('/api/ps/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM primary_societies WHERE id=?', [req.params.id]);
    res.json({ message: 'Society deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting society' });
  }
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, ps: user.ps },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        ps: user.ps,
        darkMode: Boolean(user.darkMode),
        testMode: Boolean(user.testMode)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, ps } = req.body;
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const role = 'Clerk';
    const effectivePs = ps || 'All';

    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role, effectivePs, 0, 0,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    const token = jwt.sign({ id, username, role, ps: effectivePs }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id, username, fullName, role, ps: effectivePs, darkMode: false, testMode: false } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const query = supervisor
      ? 'SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users'
      : "SELECT id, username, fullName, role, ps, darkMode, testMode, createdAt FROM users WHERE ps = 'All' OR ps = ?";
    const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { username, password, fullName, role, ps } = req.body;
    const effectivePs = isSupervisor(req.user) ? (ps || 'All') : req.user.ps;

    const [psRows] = await db.execute('SELECT id FROM primary_societies WHERE code = ?', [effectivePs]);
    if (psRows.length === 0 && effectivePs !== 'All') {
      return res.status(400).json({ error: 'Invalid Primary Society code' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, testMode, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role || 'Clerk', effectivePs, 0, 0,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, username, fullName, role: role || 'Clerk', ps: effectivePs });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isSelf = req.user.id === targetId;
    const supervisor = isSupervisor(req.user);

    // Only supervisors can update other users; anyone can update their own prefs
    if (!supervisor && !isSelf) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { fullName, role, ps, password, darkMode, testMode } = req.body;

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (fullName !== undefined) { updates.push('fullName = ?'); params.push(fullName); }
    if (darkMode !== undefined) { updates.push('darkMode = ?'); params.push(darkMode ? 1 : 0); }
    if (testMode !== undefined && supervisor) { updates.push('testMode = ?'); params.push(testMode ? 1 : 0); }
    if (role !== undefined && supervisor) { updates.push('role = ?'); params.push(role); }
    if (ps !== undefined && supervisor) { updates.push('ps = ?'); params.push(ps); }
    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) return res.json({ message: 'Nothing to update' });

    params.push(targetId);
    await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Return updated user
    const [rows] = await db.execute(
      'SELECT id, username, fullName, role, ps, darkMode, testMode FROM users WHERE id = ?',
      [targetId]
    );
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const [rows] = await db.execute('SELECT username FROM users WHERE id = ?', [req.params.id]);
    if (rows.length > 0 && rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin' });
    }
    await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

// ─── SEASONS ─────────────────────────────────────────────────────────────────

app.get('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM seasons ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO seasons (id, name, startDate, endDate, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, startDate, endDate, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, startDate, endDate, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating season' });
  }
});

app.put('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    await db.execute(`UPDATE seasons SET name=?, startDate=?, endDate=?, status=? WHERE id=?`,
      [name, startDate, endDate, status, req.params.id]);
    res.json({ id: req.params.id, name, startDate, endDate, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating season' });
  }
});

app.delete('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM seasons WHERE id=?', [req.params.id]);
    res.json({ message: 'Season deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting season' });
  }
});

// ─── GRADES ──────────────────────────────────────────────────────────────────

app.get('/api/grades', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM grades ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/grades', authenticateToken, async (req, res) => {
  try {
    const { name, price, description, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO grades (id, name, price, description, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, price, description, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, price, description, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating grade' });
  }
});

app.put('/api/grades/:id', authenticateToken, async (req, res) => {
  try {
    const { name, price, description, status } = req.body;
    await db.execute('UPDATE grades SET name=?, price=?, description=?, status=? WHERE id=?',
      [name, price, description, status, req.params.id]);
    res.json({ id: req.params.id, name, price, description, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating grade' });
  }
});

app.delete('/api/grades/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM grades WHERE id=?', [req.params.id]);
    res.json({ message: 'Grade deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting grade' });
  }
});

// ─── MARKET CENTERS ──────────────────────────────────────────────────────────

app.get('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM market_centers ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const { name, location, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO market_centers (id, name, location, status, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, name, location, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, location, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating market center' });
  }
});

app.put('/api/market-centers/:id', authenticateToken, async (req, res) => {
  try {
    const { name, location, status } = req.body;
    await db.execute('UPDATE market_centers SET name=?, location=?, status=? WHERE id=?',
      [name, location, status, req.params.id]);
    res.json({ id: req.params.id, name, location, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating market center' });
  }
});

app.delete('/api/market-centers/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM market_centers WHERE id=?', [req.params.id]);
    res.json({ message: 'Market center deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting market center' });
  }
});

// ─── FARMERS ─────────────────────────────────────────────────────────────────

app.get('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT f.*, s.name as seasonName
                       FROM farmers f
                       LEFT JOIN seasons s ON f.seasonId = s.id`;
    const whereClause = supervisor ? '' : " WHERE f.ps = 'All' OR f.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY f.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const { farmerNumber, firstName, middleName, lastName, gender, age, village,
            phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO farmers (id, farmerNumber, firstName, middleName, lastName, gender, age,
                       village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, ps, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerNumber, firstName, middleName, lastName, gender, age, village,
       phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
       effectivePs, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerNumber, firstName, middleName, lastName, gender, age, village,
               phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId,
               status: status || 'Active', ps: effectivePs });
  } catch (error) {
    console.error('Create farmer error:', error);
    res.status(500).json({ error: 'Error creating farmer' });
  }
});

app.put('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    const { firstName, middleName, lastName, gender, age, village, phoneNumber,
            idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    await db.execute(`UPDATE farmers SET firstName=?, middleName=?, lastName=?, gender=?, age=?, village=?,
                       phoneNumber=?, idType=?, idNumber=?, hectares=?, contractedVolume=?, seasonId=?, ps=?, status=?
                      WHERE id=?`,
      [firstName, middleName, lastName, gender, age, village, phoneNumber,
       idType, idNumber, hectares, contractedVolume, seasonId, effectivePs, status || 'Active', req.params.id]);

    res.json({ id: req.params.id, firstName, middleName, lastName, gender, age, village,
               phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps: effectivePs });
  } catch (error) {
    res.status(500).json({ error: 'Error updating farmer' });
  }
});

app.delete('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM farmers WHERE id=?', [req.params.id]);
    res.json({ message: 'Farmer deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting farmer' });
  }
});

// ─── INPUT TYPES ─────────────────────────────────────────────────────────────

app.get('/api/input-types', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM input_types ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/input-types', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, category, unitPrice, unit, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO input_types (id, name, category, unitPrice, unit, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, unitPrice, unit, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, name, category, unitPrice, unit, status });
  } catch (error) {
    res.status(500).json({ error: 'Error creating input type' });
  }
});

app.put('/api/input-types/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { name, category, unitPrice, unit, status } = req.body;
    await db.execute('UPDATE input_types SET name=?, category=?, unitPrice=?, unit=?, status=? WHERE id=?',
      [name, category, unitPrice, unit, status, req.params.id]);
    res.json({ id: req.params.id, name, category, unitPrice, unit, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating input type' });
  }
});

app.delete('/api/input-types/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM input_types WHERE id=?', [req.params.id]);
    res.json({ message: 'Input type deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting input type' });
  }
});

// ─── ISSUED INPUTS ────────────────────────────────────────────────────────────

app.get('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT ii.*, f.farmerNumber, f.firstName, f.lastName, it.name as inputName
                       FROM issued_inputs ii
                       JOIN farmers f ON ii.farmerId = f.id
                       JOIN input_types it ON ii.inputTypeId = it.id`;
    const whereClause = supervisor ? '' : " WHERE ii.ps = 'All' OR ii.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY ii.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const { farmerId, inputTypeId, quantity, totalCost, issueDate, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    if (!supervisor) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id=?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to issue inputs for this farmer' });
      }
    }

    await db.execute(`INSERT INTO issued_inputs (id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, inputTypeId, quantity, totalCost, issueDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps: effectivePs });
  } catch (error) {
    res.status(500).json({ error: 'Error issuing input' });
  }
});

app.delete('/api/issued-inputs/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM issued_inputs WHERE id=?', [req.params.id]);
    res.json({ message: 'Input deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting issued input' });
  }
});

// ─── SALE NUMBERS ────────────────────────────────────────────────────────────

app.get('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT sn.*, mc.name as marketCenterName, s.name as seasonName
                                     FROM sale_numbers sn
                                     JOIN market_centers mc ON sn.marketCenterId = mc.id
                                     JOIN seasons s ON sn.seasonId = s.id
                                     ORDER BY sn.createdAt DESC`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const { saleNumber, marketCenterId, seasonId, status } = req.body;
    const id = uuidv4();
    await db.execute(`INSERT INTO sale_numbers (id, saleNumber, marketCenterId, seasonId, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, saleNumber, marketCenterId, seasonId, status || 'Active',
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);
    res.json({ id, saleNumber, marketCenterId, seasonId, status: status || 'Active' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating sale number' });
  }
});

app.put('/api/sale-numbers/:id', authenticateToken, async (req, res) => {
  try {
    const { saleNumber, marketCenterId, seasonId, status } = req.body;
    await db.execute('UPDATE sale_numbers SET saleNumber=?, marketCenterId=?, seasonId=?, status=? WHERE id=?',
      [saleNumber, marketCenterId, seasonId, status, req.params.id]);
    res.json({ id: req.params.id, saleNumber, marketCenterId, seasonId, status });
  } catch (error) {
    res.status(500).json({ error: 'Error updating sale number' });
  }
});

app.delete('/api/sale-numbers/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM sale_numbers WHERE id=?', [req.params.id]);
    res.json({ message: 'Sale number deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting sale number' });
  }
});

// ─── TICKETS ─────────────────────────────────────────────────────────────────

app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
                               g.name as gradeName, mc.name as marketCenterName, sn.saleNumber
                       FROM tickets t
                       JOIN farmers f ON t.farmerId = f.id
                       JOIN grades g ON t.gradeId = g.id
                       JOIN market_centers mc ON t.marketCenterId = mc.id
                       JOIN sale_numbers sn ON t.saleNumberId = sn.id`;
    const whereClause = supervisor ? '' : " WHERE t.ps = 'All' OR t.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY t.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Check if a ticket number exists (for duplicate detection)
app.get('/api/tickets/check/:ticketNumber', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
              g.name as gradeName, mc.name as marketCenterName, sn.saleNumber
       FROM tickets t
       JOIN farmers f ON t.farmerId = f.id
       JOIN grades g ON t.gradeId = g.id
       JOIN market_centers mc ON t.marketCenterId = mc.id
       JOIN sale_numbers sn ON t.saleNumberId = sn.id
       WHERE t.ticketNumber = ?`,
      [req.params.ticketNumber]
    );
    if (rows.length > 0) {
      res.json({ exists: true, ticket: rows[0] });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
            grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    // Check for duplicate
    const [existing] = await db.execute('SELECT id FROM tickets WHERE ticketNumber=?', [ticketNumber]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ticket already exists', ticketId: existing[0].id });
    }

    if (!supervisor) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id=?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to create ticket for this farmer' });
      }
    }

    await db.execute(`INSERT INTO tickets (id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId,
                       saleNumberId, grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
       grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
               grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps: effectivePs });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Error creating ticket' });
  }
});

app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update tickets' });
    const { farmerId, gradeId, marketCenterId, saleNumberId,
            grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber } = req.body;

    await db.execute(`UPDATE tickets SET farmerId=?, gradeId=?, marketCenterId=?, saleNumberId=?,
                       grossWeight=?, tareWeight=?, netWeight=?, pricePerKg=?, totalValue=?,
                       captureDate=?, pcnNumber=? WHERE id=?`,
      [farmerId, gradeId, marketCenterId, saleNumberId,
       grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, pcnNumber, req.params.id]);

    res.json({ id: req.params.id, message: 'Ticket updated' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating ticket' });
  }
});

app.delete('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM tickets WHERE id=?', [req.params.id]);
    res.json({ message: 'Ticket deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting ticket' });
  }
});

// ─── PCNs ─────────────────────────────────────────────────────────────────────

app.get('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const query = supervisor
      ? 'SELECT * FROM pcns ORDER BY createdAt DESC'
      : "SELECT * FROM pcns WHERE ps = 'All' OR ps = ? ORDER BY createdAt DESC";
    const [rows] = await db.execute(query, supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const { pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status } = req.body;
    const id = uuidv4();
    const supervisor = isSupervisor(req.user);
    const effectivePs = supervisor ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pcnNumber, saleNumber, effectivePs, totalFarmers || 0, totalTickets || 0,
       totalWeight || 0, totalValue || 0, status || 'Open',
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, pcnNumber, saleNumber, ps: effectivePs, totalFarmers, totalTickets, totalWeight, totalValue, status: status || 'Open' });
  } catch (error) {
    console.error('Create PCN error:', error);
    res.status(500).json({ error: 'Error creating PCN' });
  }
});

app.put('/api/pcns/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can update PCNs' });
    const { status, totalFarmers, totalTickets, totalWeight, totalValue } = req.body;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const updates = [];
    const params = [];

    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'Closed') {
        updates.push('closedAt = ?', 'closedBy = ?');
        params.push(now, req.user.username);
      }
      if (status === 'Approved') {
        updates.push('approvedAt = ?', 'approvedBy = ?');
        params.push(now, req.user.username);
      }
    }
    if (totalFarmers !== undefined) { updates.push('totalFarmers = ?'); params.push(totalFarmers); }
    if (totalTickets !== undefined) { updates.push('totalTickets = ?'); params.push(totalTickets); }
    if (totalWeight !== undefined) { updates.push('totalWeight = ?'); params.push(totalWeight); }
    if (totalValue !== undefined) { updates.push('totalValue = ?'); params.push(totalValue); }

    if (updates.length === 0) return res.json({ message: 'Nothing to update' });

    params.push(req.params.id);
    await db.execute(`UPDATE pcns SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.execute('SELECT * FROM pcns WHERE id=?', [req.params.id]);
    res.json(rows[0] || {});
  } catch (error) {
    console.error('Update PCN error:', error);
    res.status(500).json({ error: 'Error updating PCN' });
  }
});

app.delete('/api/pcns/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM pcns WHERE id=?', [req.params.id]);
    res.json({ message: 'PCN deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting PCN' });
  }
});

// ─── EXCHANGE RATE ────────────────────────────────────────────────────────────

app.get('/api/exchange-rate', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT value FROM system_settings WHERE key='exchange_rate'");
    if (rows.length > 0) {
      res.json(JSON.parse(rows[0].value));
    } else {
      res.json({ rate: '', locked: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/exchange-rate', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Only Supervisors can set exchange rate' });
    const { rate, locked } = req.body;
    const value = JSON.stringify({ rate, locked });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      "INSERT INTO system_settings (key, value, updatedAt) VALUES ('exchange_rate', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updatedAt=excluded.updatedAt",
      [value, now]
    );
    res.json({ rate, locked });
  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({ error: 'Error saving exchange rate' });
  }
});

// ─── PAYMENTS ────────────────────────────────────────────────────────────────

app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT p.*, f.farmerNumber, f.firstName, f.lastName, f.village, f.phoneNumber,
                               pcn.pcnNumber
                       FROM payments p
                       JOIN farmers f ON p.farmerId = f.id
                       LEFT JOIN pcns pcn ON p.pcnId = pcn.id`;
    const whereClause = supervisor ? '' : " WHERE p.ps = 'All' OR p.ps = ?";
    const [rows] = await db.execute(baseQuery + whereClause + ' ORDER BY p.createdAt DESC',
      supervisor ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    const { farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
            exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps } = req.body;
    const id = uuidv4();
    const effectivePs = ps || req.user.ps;

    await db.execute(`INSERT INTO payments (id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
                       exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, pcnId || null, tobaccoAmount, inputDeduction, usdBalance || 0,
       exchangeRate || 0, tzsGross || 0, levy || 0, adminFee || 0, totalDeductions || 0,
       netPayment, paymentDate, effectivePs,
       new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, pcnId, tobaccoAmount, inputDeduction, usdBalance,
               exchangeRate, tzsGross, levy, adminFee, totalDeductions, netPayment, paymentDate, ps: effectivePs });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Error creating payment' });
  }
});

app.delete('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    if (!isSupervisor(req.user)) return res.status(403).json({ error: 'Access denied' });
    await db.execute('DELETE FROM payments WHERE id=?', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting payment' });
  }
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

// Sales by Sale Number summary report
app.get('/api/reports/sales-by-sale', authenticateToken, async (req, res) => {
  try {
    const supervisor = isSupervisor(req.user);
    const psFilter = req.user.ps || 'All';
    const whereClause = supervisor ? '' : " WHERE t.ps = 'All' OR t.ps = ?";

    const [rows] = await db.execute(
      `SELECT sn.saleNumber, t.ps,
              COUNT(t.id) as totalBales,
              SUM(t.netWeight) as totalMass,
              SUM(t.totalValue) as totalValue,
              CASE WHEN SUM(t.netWeight) > 0 THEN SUM(t.totalValue) / SUM(t.netWeight) ELSE 0 END as avgPrice,
              mc.name as marketCenter
       FROM tickets t
       JOIN sale_numbers sn ON t.saleNumberId = sn.id
       JOIN market_centers mc ON t.marketCenterId = mc.id
       ${whereClause}
       GROUP BY sn.saleNumber, t.ps, mc.name
       ORDER BY sn.saleNumber`,
      supervisor ? [] : [psFilter]
    );
    res.json(rows);
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  if (sqliteDb) {
    sqliteDb.close().then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});