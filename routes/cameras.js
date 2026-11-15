// routes/cameras.js - Camera API Routes with Case-Insensitive Duplicate Validation & Search
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @route   GET /cameras
 * @desc    Fetch all cameras, with optional case-insensitive & partial filter by kind (?kind=...)
 * @access  Public
 */
router.get('/', (req, res) => {
  const { kind } = req.query;

  if (kind && typeof kind === 'string' && kind.trim() !== '') {
    const trimmedKind = kind.trim();
    // SQLite LIKE is case-insensitive for ASCII and supports exact as well as partial matches
    const sql = 'SELECT * FROM cameras WHERE kind LIKE ? ORDER BY id ASC';
    db.all(sql, [`%${trimmedKind}%`], (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'Database error occurred while filtering cameras by kind.',
          details: err.message
        });
      }
      res.status(200).json(rows);
    });
  } else {
    // Empty search or no query param returns all cameras
    const sql = 'SELECT * FROM cameras ORDER BY id ASC';
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({
          error: 'Database error occurred while fetching cameras.',
          details: err.message
        });
      }
      res.status(200).json(rows);
    });
  }
});

/**
 * @route   GET /cameras/:id
 * @desc    Fetch a single camera by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid camera ID. ID must be a positive integer.'
    });
  }

  const sql = 'SELECT * FROM cameras WHERE id = ?';
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while fetching camera.',
        details: err.message
      });
    }

    if (!row) {
      return res.status(404).json({
        error: `Camera with ID ${id} not found.`
      });
    }

    res.status(200).json(row);
  });
});

/**
 * @route   POST /cameras
 * @desc    Create a new camera with case-insensitive duplicate validation
 * @access  Public
 */
router.post('/', (req, res) => {
  const { name, kind } = req.body;

  // Validation: both name and kind are required and must not be empty
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({
      error: 'Validation failed: Camera name is required and cannot be empty.'
    });
  }

  if (!kind || typeof kind !== 'string' || kind.trim() === '') {
    return res.status(400).json({
      error: 'Validation failed: Camera kind is required and cannot be empty.'
    });
  }

  const trimmedName = name.trim();
  const trimmedKind = kind.trim();

  // Application-level check for duplicate name (case-insensitive)
  const duplicateCheckSql = 'SELECT id FROM cameras WHERE name = ? COLLATE NOCASE';
  db.get(duplicateCheckSql, [trimmedName], (checkErr, existingRow) => {
    if (checkErr) {
      return res.status(500).json({
        error: 'Database error occurred during duplicate name check.',
        details: checkErr.message
      });
    }

    if (existingRow) {
      return res.status(409).json({
        error: `${trimmedName} already exists`
      });
    }

    // Insert new camera record
    const insertSql = 'INSERT INTO cameras (name, kind, status) VALUES (?, ?, ?)';
    db.run(insertSql, [trimmedName, trimmedKind, 'available'], function (insertErr) {
      if (insertErr) {
        // Handle database-level constraint violations (e.g., UNIQUE constraint race conditions)
        if (insertErr.message && insertErr.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            error: `${trimmedName} already exists`
          });
        }
        return res.status(500).json({
          error: 'Database error occurred while creating camera.',
          details: insertErr.message
        });
      }

      res.status(201).json({
        message: 'Camera created successfully',
        id: this.lastID,
        name: trimmedName,
        kind: trimmedKind,
        status: 'available'
      });
    });
  });
});

/**
 * @route   PUT /cameras/:id
 * @desc    Update camera name and kind with case-insensitive duplicate validation
 * @access  Public
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, kind } = req.body;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid camera ID. ID must be a positive integer.'
    });
  }

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({
      error: 'Validation failed: Camera name is required and cannot be empty.'
    });
  }

  if (!kind || typeof kind !== 'string' || kind.trim() === '') {
    return res.status(400).json({
      error: 'Validation failed: Camera kind is required and cannot be empty.'
    });
  }

  const trimmedName = name.trim();
  const trimmedKind = kind.trim();

  // 1. Check if the camera exists
  const existsSql = 'SELECT * FROM cameras WHERE id = ?';
  db.get(existsSql, [id], (existsErr, existingCamera) => {
    if (existsErr) {
      return res.status(500).json({
        error: 'Database error occurred while verifying camera.',
        details: existsErr.message
      });
    }

    if (!existingCamera) {
      return res.status(404).json({
        error: `Camera with ID ${id} not found.`
      });
    }

    // 2. Check for duplicate name case-insensitively, excluding the current camera ID
    const duplicateCheckSql = 'SELECT id FROM cameras WHERE name = ? COLLATE NOCASE AND id != ?';
    db.get(duplicateCheckSql, [trimmedName, id], (dupErr, duplicateRow) => {
      if (dupErr) {
        return res.status(500).json({
          error: 'Database error occurred during duplicate name check.',
          details: dupErr.message
        });
      }

      if (duplicateRow) {
        return res.status(409).json({
          error: `${trimmedName} already exists`
        });
      }

      // 3. Update the camera
      const updateSql = 'UPDATE cameras SET name = ?, kind = ? WHERE id = ?';
      db.run(updateSql, [trimmedName, trimmedKind, id], function (updateErr) {
        if (updateErr) {
          if (updateErr.message && updateErr.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
              error: `${trimmedName} already exists`
            });
          }
          return res.status(500).json({
            error: 'Database error occurred while updating camera.',
            details: updateErr.message
          });
        }

        res.status(200).json({
          message: 'Camera updated successfully',
          id: parseInt(id, 10),
          name: trimmedName,
          kind: trimmedKind,
          status: existingCamera.status
        });
      });
    });
  });
});

/**
 * @route   DELETE /cameras/:id
 * @desc    Delete a camera record, preventing deletion if referenced by rentals
 * @access  Public
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid camera ID. ID must be a positive integer.'
    });
  }

  // 1. Verify whether the camera exists
  const checkExistsSql = 'SELECT * FROM cameras WHERE id = ?';
  db.get(checkExistsSql, [id], (existsErr, camera) => {
    if (existsErr) {
      return res.status(500).json({
        error: 'Database error occurred while verifying camera existence.',
        details: existsErr.message
      });
    }

    if (!camera) {
      return res.status(404).json({
        error: `Camera with ID ${id} not found.`
      });
    }

    // 2. Application check: verify whether any rental references this camera
    const rentalCheckSql = 'SELECT COUNT(*) AS count FROM rentals WHERE camera_id = ?';
    db.get(rentalCheckSql, [id], (rentErr, rentRow) => {
      if (rentErr) {
        return res.status(500).json({
          error: 'Database error occurred while checking rental references.',
          details: rentErr.message
        });
      }

      if (rentRow && rentRow.count > 0) {
        return res.status(409).json({
          error: 'Cannot delete camera. It is currently referenced by one or more rental records.'
        });
      }

      // 3. Delete the camera record (with database-level foreign key safety net)
      const deleteSql = 'DELETE FROM cameras WHERE id = ?';
      db.run(deleteSql, [id], function (delErr) {
        if (delErr) {
          if (delErr.message && delErr.message.includes('FOREIGN KEY constraint failed')) {
            return res.status(409).json({
              error: 'Cannot delete camera. It is currently referenced by one or more rental records.'
            });
          }
          return res.status(500).json({
            error: 'Database error occurred while deleting camera.',
            details: delErr.message
          });
        }

        res.status(200).json({
          message: 'Camera deleted successfully',
          id: parseInt(id, 10)
        });
      });
    });
  });
});

module.exports = router;
