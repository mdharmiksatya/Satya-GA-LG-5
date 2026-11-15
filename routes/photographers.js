// routes/photographers.js - Photographer API Routes
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * @route   GET /photographers
 * @desc    Fetch all photographers
 * @access  Public
 */
router.get('/', (req, res) => {
  const sql = 'SELECT * FROM photographers ORDER BY id ASC';

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while fetching photographers.',
        details: err.message
      });
    }

    res.status(200).json(rows);
  });
});

/**
 * @route   GET /photographers/:id
 * @desc    Fetch a single photographer by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  // Validate that ID is a positive integer
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid photographer ID. ID must be a positive integer.'
    });
  }

  const sql = 'SELECT * FROM photographers WHERE id = ?';

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while fetching photographer.',
        details: err.message
      });
    }

    if (!row) {
      return res.status(404).json({
        error: `Photographer with ID ${id} not found.`
      });
    }

    res.status(200).json(row);
  });
});

/**
 * @route   POST /photographers
 * @desc    Create a new photographer
 * @access  Public
 */
router.post('/', (req, res) => {
  const { name, email, phone } = req.body;

  // Validation: 'name' is required and must not be empty
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({
      error: 'Validation failed: Name is required and cannot be empty.'
    });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email && typeof email === 'string' && email.trim() !== '' ? email.trim() : null;
  const trimmedPhone = phone && typeof phone === 'string' && phone.trim() !== '' ? phone.trim() : null;

  // Validate email format when provided
  if (trimmedEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        error: 'Validation failed: Invalid email format.'
      });
    }
  }

  const sql = 'INSERT INTO photographers (name, email, phone) VALUES (?, ?, ?)';

  db.run(sql, [trimmedName, trimmedEmail, trimmedPhone], function (err) {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while creating photographer.',
        details: err.message
      });
    }

    res.status(201).json({
      message: 'Photographer created successfully',
      id: this.lastID,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone
    });
  });
});

module.exports = router;
