// config/db.js - SQLite Database Configuration & Initialization
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Ensure the database directory exists
const dbDir = path.resolve(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database file path
const dbPath = path.join(dbDir, 'lenslab.db');

// Initialize the SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${dbPath}`);
  }
});

// Configure database settings and initialize tables sequentially
db.serialize(() => {
  // 1. Enable Foreign Key Constraints (SQLite disables foreign keys by default)
  db.run('PRAGMA foreign_keys = ON;', (err) => {
    if (err) {
      console.error('Failed to enable foreign keys:', err.message);
    } else {
      console.log('SQLite foreign key constraints enabled.');
    }
  });

  // 2. Create 'photographers' table
  db.run(`
    CREATE TABLE IF NOT EXISTS photographers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT
    )
  `, (err) => {
    if (err) {
      console.error("Error creating 'photographers' table:", err.message);
    }
  });

  // 3. Create 'cameras' table
  // Note: COLLATE NOCASE ensures case-insensitive matching and duplicate prevention for camera names
  db.run(`
    CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      kind TEXT NOT NULL,
      status TEXT DEFAULT 'available'
    )
  `, (err) => {
    if (err) {
      console.error("Error creating 'cameras' table:", err.message);
    }
  });

  // 4. Create 'rentals' table with foreign keys referencing photographers(id) and cameras(id)
  db.run(`
    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photographer_id INTEGER NOT NULL,
      camera_id INTEGER NOT NULL,
      rental_date TEXT,
      return_date TEXT,
      FOREIGN KEY (photographer_id) REFERENCES photographers(id),
      FOREIGN KEY (camera_id) REFERENCES cameras(id)
    )
  `, (err) => {
    if (err) {
      console.error("Error creating 'rentals' table:", err.message);
    }
  });

  // 5. Seed initial sample data for testing
  seedSampleData();
});

/**
 * Seeds initial sample records for photographers and cameras.
 * Uses parameterized queries and existence checks to prevent duplicates on repeated starts.
 */
function seedSampleData() {
  // Sample Photographers
  const samplePhotographers = [
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101' },
    { name: 'Bob Smith', email: 'bob@example.com', phone: '555-0102' },
    { name: 'Charlie Davis', email: 'charlie@example.com', phone: '555-0103' }
  ];

  samplePhotographers.forEach((photographer) => {
    const checkSql = 'SELECT id FROM photographers WHERE email = ?';
    db.get(checkSql, [photographer.email], (err, row) => {
      if (err) {
        console.error('Error checking photographer record:', err.message);
        return;
      }
      // Only insert if the record does not already exist
      if (!row) {
        const insertSql = 'INSERT INTO photographers (name, email, phone) VALUES (?, ?, ?)';
        db.run(insertSql, [photographer.name, photographer.email, photographer.phone], function (insertErr) {
          if (insertErr) {
            console.error('Error inserting sample photographer:', insertErr.message);
          } else {
            console.log(`Sample photographer added: ${photographer.name} (ID: ${this.lastID})`);
          }
        });
      }
    });
  });

  // Sample Cameras
  const sampleCameras = [
    { name: 'Canon EOS R5', kind: 'Mirrorless', status: 'available' },
    { name: 'Sony A7 IV', kind: 'Mirrorless', status: 'available' },
    { name: 'Nikon D850', kind: 'DSLR', status: 'available' }
  ];

  sampleCameras.forEach((camera) => {
    // Check case-insensitively using COLLATE NOCASE
    const checkSql = 'SELECT id FROM cameras WHERE name = ? COLLATE NOCASE';
    db.get(checkSql, [camera.name], (err, row) => {
      if (err) {
        console.error('Error checking camera record:', err.message);
        return;
      }
      // Only insert if the camera does not already exist
      if (!row) {
        const insertSql = 'INSERT INTO cameras (name, kind, status) VALUES (?, ?, ?)';
        db.run(insertSql, [camera.name, camera.kind, camera.status], function (insertErr) {
          if (insertErr) {
            console.error('Error inserting sample camera:', insertErr.message);
          } else {
            console.log(`Sample camera added: ${camera.name} (ID: ${this.lastID})`);
          }
        });
      }
    });
  });
}

module.exports = db;
