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
let db; // Fake pool object to mock mysql2

async function initializeDatabase() {
  try {
    // Open SQLite database file directly
    sqliteDb = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    // Mock the mysql2 execution pipeline
    db = {
      async execute(sql, params = []) {
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          const rows = await sqliteDb.all(sql, params);
          return [rows]; // Emulate [rows, fields]
        } else {
          const result = await sqliteDb.run(sql, params);
          return [result]; // Emulate [result, fields]
        }
      }
    };

    console.log('Connected to SQLite database securely.');

    // Create tables and ensure required columns exist
    await createTables();
    await ensurePsColumns();
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

// Create database tables
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
      hectares DECIMAL(10,2),
      contractedVolume DECIMAL(10,2),
      seasonId VARCHAR(36),
      ps VARCHAR(50) NOT NULL,
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
      totalFarmers INT NOT NULL,
      totalTickets INT NOT NULL,
      totalWeight DECIMAL(10,2) NOT NULL,
      totalValue DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL,
      createdAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(36) PRIMARY KEY,
      farmerId VARCHAR(36) NOT NULL,
      pcnId VARCHAR(36),
      tobaccoAmount DECIMAL(10,2) NOT NULL,
      inputDeduction DECIMAL(10,2) NOT NULL,
      netPayment DECIMAL(10,2) NOT NULL,
      paymentDate DATE NOT NULL,
      ps VARCHAR(50) NOT NULL,
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (farmerId) REFERENCES farmers(id),
      FOREIGN KEY (pcnId) REFERENCES pcns(id)
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

async function ensurePsColumns() {
  const alterations = [
    "ALTER TABLE farmers ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE issued_inputs ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE tickets ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE payments ADD COLUMN ps VARCHAR(50) NOT NULL DEFAULT 'All'",
    "ALTER TABLE farmers ADD COLUMN middleName VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN gender VARCHAR(10)",
    "ALTER TABLE farmers ADD COLUMN age INT",
    "ALTER TABLE farmers ADD COLUMN hectares DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN contractedVolume DECIMAL(10,2)",
    "ALTER TABLE farmers ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Active'",
    "ALTER TABLE farmers ADD COLUMN idType VARCHAR(50)",
    "ALTER TABLE farmers ADD COLUMN idNumber VARCHAR(100)",
    "ALTER TABLE tickets ADD COLUMN pcnNumber VARCHAR(50)"
  ];

  for (const sql of alterations) {
    try {
      await db.execute(sql);
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Error adding PS column:', error.message);
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
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    // Check if admin user exists
    const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', ['admin']);

    if (rows.length === 0) {
      await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [adminUser.id, adminUser.username, adminUser.password, adminUser.fullName,
         adminUser.role, adminUser.ps, adminUser.darkMode, adminUser.createdAt]);
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
initializeDatabase();

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Load the latest user info from the database (including PS).
    const [rows] = await db.execute('SELECT id, username, fullName, role, ps, darkMode FROM users WHERE id = ?', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// API Routes

// Primary societies
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
    // Only Admins can create new societies
    if (req.user.role !== 'Admin') {
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

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

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
        darkMode: Boolean(user.darkMode)
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
    
    // Check if user already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const role = 'Capture Clerk';
    const effectivePs = ps || 'All';

    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, darkMode, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role, effectivePs, 0, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    // Generate token for auto-login
    const token = jwt.sign(
      { id, username, role, ps: effectivePs },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id,
        username,
        fullName,
        role,
        ps: effectivePs,
        darkMode: false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// User management
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Admin sees all users; others see global (ps='All') plus their own PS
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';

    const query = isAdmin
      ? 'SELECT id, username, fullName, role, ps, darkMode, createdAt FROM users'
      : "SELECT id, username, fullName, role, ps, darkMode, createdAt FROM users WHERE ps = 'All' OR ps = ?";

    const [rows] = await db.execute(query, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const { username, password, fullName, role, ps } = req.body;

    // Only admins can create users for any PS.
    // Supervisors/clerks can only create users for their own PS.
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? ps : req.user.ps;

    // Validate PS exists
    const [psRows] = await db.execute('SELECT id FROM primary_societies WHERE code = ?', [effectivePs]);
    if (psRows.length === 0 && effectivePs !== 'All') {
      return res.status(400).json({ error: 'Invalid Primary Society code' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();

    await db.execute(`INSERT INTO users (id, username, password, fullName, role, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, username, hashedPassword, fullName, role, effectivePs, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, username, fullName, role, ps: effectivePs });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Seasons
app.get('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM seasons ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get seasons error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/seasons', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const id = uuidv4();

    await db.execute(`INSERT INTO seasons (id, name, startDate, endDate, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, startDate, endDate, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, name, startDate, endDate, status });
  } catch (error) {
    console.error('Create season error:', error);
    res.status(500).json({ error: 'Error creating season' });
  }
});

app.put('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;

    await db.execute(`UPDATE seasons SET name = ?, startDate = ?, endDate = ?, status = ?
                      WHERE id = ?`,
      [name, startDate, endDate, status, req.params.id]);

    res.json({ id: req.params.id, name, startDate, endDate, status });
  } catch (error) {
    console.error('Update season error:', error);
    res.status(500).json({ error: 'Error updating season' });
  }
});

app.delete('/api/seasons/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute('DELETE FROM seasons WHERE id = ?', [req.params.id]);
    res.json({ message: 'Season deleted' });
  } catch (error) {
    console.error('Delete season error:', error);
    res.status(500).json({ error: 'Error deleting season' });
  }
});

// Grades
app.get('/api/grades', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM grades ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/grades', authenticateToken, async (req, res) => {
  try {
    const { name, price, description, status } = req.body;
    const id = uuidv4();

    await db.execute(`INSERT INTO grades (id, name, price, description, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, price, description, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, name, price, description, status });
  } catch (error) {
    console.error('Create grade error:', error);
    res.status(500).json({ error: 'Error creating grade' });
  }
});

// Market Centers
app.get('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM market_centers ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get market centers error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/market-centers', authenticateToken, async (req, res) => {
  try {
    const { name, location, status } = req.body;
    const id = uuidv4();

    await db.execute(`INSERT INTO market_centers (id, name, location, status, createdAt)
                      VALUES (?, ?, ?, ?, ?)`,
      [id, name, location, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, name, location, status });
  } catch (error) {
    console.error('Create market center error:', error);
    res.status(500).json({ error: 'Error creating market center' });
  }
});

// Farmers
app.get('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT f.*, s.name as seasonName
                       FROM farmers f
                       LEFT JOIN seasons s ON f.seasonId = s.id`;
    const whereClause = isAdmin ? '' : " WHERE f.ps = 'All' OR f.ps = ?";
    const orderBy = ' ORDER BY f.createdAt DESC';

    const [rows] = await db.execute(baseQuery + whereClause + orderBy, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get farmers error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/farmers', authenticateToken, async (req, res) => {
  try {
    const { farmerNumber, firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const id = uuidv4();
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO farmers (id, farmerNumber, firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, ps, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerNumber, firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, effectivePs, status || 'Active', new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerNumber, firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status: status || 'Active', ps: effectivePs });
  } catch (error) {
    console.error('Create farmer error:', error);
    res.status(500).json({ error: 'Error creating farmer' });
  }
});

app.put('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    const { firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status, ps } = req.body;
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    await db.execute(`UPDATE farmers 
                      SET firstName = ?, middleName = ?, lastName = ?, gender = ?, age = ?, village = ?, phoneNumber = ?, idType = ?, idNumber = ?, hectares = ?, contractedVolume = ?, seasonId = ?, ps = ?, status = ?
                      WHERE id = ?`,
      [firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, effectivePs, status || 'Active', req.params.id]);

    res.json({ id: req.params.id, firstName, middleName, lastName, gender, age, village, phoneNumber, idType, idNumber, hectares, contractedVolume, seasonId, status: status || 'Active', ps: effectivePs });
  } catch (error) {
    console.error('Update farmer error:', error);
    res.status(500).json({ error: 'Error updating farmer' });
  }
});

app.delete('/api/farmers/:id', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    // If you want strictly PS-based deletion guards, add here. Currently simple delete.
    await db.execute('DELETE FROM farmers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Farmer deleted' });
  } catch (error) {
    console.error('Delete farmer error:', error);
    res.status(500).json({ error: 'Error deleting farmer' });
  }
});

// Input Types
app.get('/api/input-types', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM input_types ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get input types error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/input-types', authenticateToken, async (req, res) => {
  try {
    const { name, category, unitPrice, unit, status } = req.body;
    const id = uuidv4();

    await db.execute(`INSERT INTO input_types (id, name, category, unitPrice, unit, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, unitPrice, unit, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, name, category, unitPrice, unit, status });
  } catch (error) {
    console.error('Create input type error:', error);
    res.status(500).json({ error: 'Error creating input type' });
  }
});

// Issued Inputs
app.get('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT ii.*, f.farmerNumber, f.firstName, f.lastName, it.name as inputName
                       FROM issued_inputs ii
                       JOIN farmers f ON ii.farmerId = f.id
                       JOIN input_types it ON ii.inputTypeId = it.id`;
    const whereClause = isAdmin ? '' : " WHERE ii.ps = 'All' OR ii.ps = ?";
    const orderBy = ' ORDER BY ii.createdAt DESC';

    const [rows] = await db.execute(baseQuery + whereClause + orderBy, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get issued inputs error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/issued-inputs', authenticateToken, async (req, res) => {
  try {
    const { farmerId, inputTypeId, quantity, totalCost, issueDate, ps } = req.body;
    const id = uuidv4();
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    // Enforce that non-admins can only issue inputs in their PS
    if (!isAdmin) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id = ?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to issue inputs for this farmer' });
      }
    }

    await db.execute(`INSERT INTO issued_inputs (id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, inputTypeId, quantity, totalCost, issueDate, effectivePs, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, inputTypeId, quantity, totalCost, issueDate, ps: effectivePs });
  } catch (error) {
    console.error('Create issued input error:', error);
    res.status(500).json({ error: 'Error issuing input' });
  }
});

// Sale Numbers
app.get('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT sn.*, mc.name as marketCenterName, s.name as seasonName
                                     FROM sale_numbers sn
                                     JOIN market_centers mc ON sn.marketCenterId = mc.id
                                     JOIN seasons s ON sn.seasonId = s.id
                                     ORDER BY sn.createdAt DESC`);
    res.json(rows);
  } catch (error) {
    console.error('Get sale numbers error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/sale-numbers', authenticateToken, async (req, res) => {
  try {
    const { saleNumber, marketCenterId, seasonId, status } = req.body;
    const id = uuidv4();

    await db.execute(`INSERT INTO sale_numbers (id, saleNumber, marketCenterId, seasonId, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, saleNumber, marketCenterId, seasonId, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, saleNumber, marketCenterId, seasonId, status });
  } catch (error) {
    console.error('Create sale number error:', error);
    res.status(500).json({ error: 'Error creating sale number' });
  }
});

// Tickets
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT t.*, f.farmerNumber, f.firstName, f.lastName,
                               g.name as gradeName, mc.name as marketCenterName, sn.saleNumber
                       FROM tickets t
                       JOIN farmers f ON t.farmerId = f.id
                       JOIN grades g ON t.gradeId = g.id
                       JOIN market_centers mc ON t.marketCenterId = mc.id
                       JOIN sale_numbers sn ON t.saleNumberId = sn.id`;
    const whereClause = isAdmin ? '' : " WHERE t.ps = 'All' OR t.ps = ?";
    const orderBy = ' ORDER BY t.createdAt DESC';

    const [rows] = await db.execute(baseQuery + whereClause + orderBy, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
            grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps } = req.body;
    const id = uuidv4();
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    // Ensure non-admins only create tickets for farmers in their PS
    if (!isAdmin) {
      const [farmerRows] = await db.execute('SELECT ps FROM farmers WHERE id = ?', [farmerId]);
      if (!farmerRows.length || farmerRows[0].ps !== effectivePs) {
        return res.status(403).json({ error: 'Not allowed to create ticket for this farmer' });
      }
    }

    await db.execute(`INSERT INTO tickets (id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
                      grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
       grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, effectivePs, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, ticketNumber, pcnNumber, farmerId, gradeId, marketCenterId, saleNumberId,
               grossWeight, tareWeight, netWeight, pricePerKg, totalValue, captureDate, ps: effectivePs });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Error creating ticket' });
  }
});

// PCNs
app.get('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';
    const query = isAdmin
      ? 'SELECT * FROM pcns ORDER BY createdAt DESC'
      : "SELECT * FROM pcns WHERE ps = 'All' OR ps = ? ORDER BY createdAt DESC";

    const [rows] = await db.execute(query, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get PCNs error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/pcns', authenticateToken, async (req, res) => {
  try {
    const { pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status } = req.body;
    const id = uuidv4();
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO pcns (id, pcnNumber, saleNumber, ps, totalFarmers, totalTickets, totalWeight, totalValue, status, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pcnNumber, saleNumber, effectivePs, totalFarmers, totalTickets, totalWeight, totalValue, status, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, pcnNumber, saleNumber, ps: effectivePs, totalFarmers, totalTickets, totalWeight, totalValue, status });
  } catch (error) {
    console.error('Create PCN error:', error);
    res.status(500).json({ error: 'Error creating PCN' });
  }
});

// Payments
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const psFilter = req.user.ps || 'All';
    const baseQuery = `SELECT p.*, f.farmerNumber, f.firstName, f.lastName, pcn.pcnNumber
                       FROM payments p
                       JOIN farmers f ON p.farmerId = f.id
                       LEFT JOIN pcns pcn ON p.pcnId = pcn.id`;
    const whereClause = isAdmin ? '' : " WHERE p.ps = 'All' OR p.ps = ?";
    const orderBy = ' ORDER BY p.createdAt DESC';

    const [rows] = await db.execute(baseQuery + whereClause + orderBy, isAdmin ? [] : [psFilter]);
    res.json(rows);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { farmerId, pcnId, tobaccoAmount, inputDeduction, netPayment, paymentDate, ps } = req.body;
    const id = uuidv4();
    const isAdmin = req.user.role === 'Admin';
    const effectivePs = isAdmin ? (ps || 'All') : req.user.ps;

    await db.execute(`INSERT INTO payments (id, farmerId, pcnId, tobaccoAmount, inputDeduction, netPayment, paymentDate, ps, createdAt)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, farmerId, pcnId, tobaccoAmount, inputDeduction, netPayment, paymentDate, effectivePs, new Date().toISOString().slice(0, 19).replace('T', ' ')]);

    res.json({ id, farmerId, pcnId, tobaccoAmount, inputDeduction, netPayment, paymentDate, ps: effectivePs });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Error creating payment' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});