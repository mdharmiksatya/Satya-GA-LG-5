// routes/rentals.js - Rental API Routes with SQL JOIN, Transactions, and Date Validation
const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * Validates whether a string is a valid date in YYYY-MM-DD format.
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * @route   GET /rentals
 * @desc    Fetch all rentals with joined photographer and camera details
 * @access  Public
 */
router.get('/', (req, res) => {
  const sql = `
    SELECT 
      rentals.id AS id,
      rentals.photographer_id AS photographer_id,
      photographers.name AS photographer_name,
      rentals.camera_id AS camera_id,
      cameras.name AS camera_name,
      cameras.kind AS camera_kind,
      rentals.rental_date AS rental_date,
      rentals.return_date AS return_date
    FROM rentals
    INNER JOIN photographers ON rentals.photographer_id = photographers.id
    INNER JOIN cameras ON rentals.camera_id = cameras.id
    ORDER BY rentals.id ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while fetching rentals.',
        details: err.message
      });
    }

    res.status(200).json(rows);
  });
});

/**
 * @route   GET /rentals/:id
 * @desc    Fetch a single rental by ID with joined photographer and camera details
 * @access  Public
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid rental ID. ID must be a positive integer.'
    });
  }

  const sql = `
    SELECT 
      rentals.id AS id,
      rentals.photographer_id AS photographer_id,
      photographers.name AS photographer_name,
      rentals.camera_id AS camera_id,
      cameras.name AS camera_name,
      cameras.kind AS camera_kind,
      rentals.rental_date AS rental_date,
      rentals.return_date AS return_date
    FROM rentals
    INNER JOIN photographers ON rentals.photographer_id = photographers.id
    INNER JOIN cameras ON rentals.camera_id = cameras.id
    WHERE rentals.id = ?
  `;

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({
        error: 'Database error occurred while fetching rental.',
        details: err.message
      });
    }

    if (!row) {
      return res.status(404).json({
        error: `Rental with ID ${id} not found.`
      });
    }

    res.status(200).json(row);
  });
});

/**
 * @route   POST /rentals
 * @desc    Create a new rental, verifying photographer, camera existence & availability
 * @access  Public
 */
router.post('/', (req, res) => {
  const { photographer_id, camera_id, rental_date, return_date } = req.body;

  // 1. Validate required IDs
  if (!photographer_id || isNaN(parseInt(photographer_id, 10)) || parseInt(photographer_id, 10) <= 0) {
    return res.status(400).json({
      error: 'Validation failed: photographer_id is required and must be a positive integer.'
    });
  }

  if (!camera_id || isNaN(parseInt(camera_id, 10)) || parseInt(camera_id, 10) <= 0) {
    return res.status(400).json({
      error: 'Validation failed: camera_id is required and must be a positive integer.'
    });
  }

  const photogId = parseInt(photographer_id, 10);
  const camId = parseInt(camera_id, 10);
  const rDate = rental_date && typeof rental_date === 'string' && rental_date.trim() !== ''
    ? rental_date.trim()
    : new Date().toISOString().split('T')[0];
  const retDate = return_date && typeof return_date === 'string' && return_date.trim() !== ''
    ? return_date.trim()
    : null;

  // Validate dates
  if (rental_date && !isValidDate(rDate)) {
    return res.status(400).json({
      error: 'Validation failed: rental_date must be a valid date in YYYY-MM-DD format.'
    });
  }

  if (retDate && !isValidDate(retDate)) {
    return res.status(400).json({
      error: 'Validation failed: return_date must be a valid date in YYYY-MM-DD format.'
    });
  }

  if (retDate && retDate < rDate) {
    return res.status(400).json({
      error: 'Validation failed: return_date cannot be earlier than rental_date.'
    });
  }

  // 2. Verify photographer exists
  db.get('SELECT id, name FROM photographers WHERE id = ?', [photogId], (pErr, photographer) => {
    if (pErr) {
      return res.status(500).json({
        error: 'Database error occurred while verifying photographer.',
        details: pErr.message
      });
    }

    if (!photographer) {
      return res.status(404).json({
        error: `Photographer with ID ${photogId} not found.`
      });
    }

    // 3. Verify camera exists and check availability
    db.get('SELECT id, name, kind, status FROM cameras WHERE id = ?', [camId], (cErr, camera) => {
      if (cErr) {
        return res.status(500).json({
          error: 'Database error occurred while verifying camera.',
          details: cErr.message
        });
      }

      if (!camera) {
        return res.status(404).json({
          error: `Camera with ID ${camId} not found.`
        });
      }

      if (camera.status !== 'available') {
        return res.status(400).json({
          error: `Camera '${camera.name}' is currently ${camera.status} and cannot be rented.`
        });
      }

      // 4. Execute atomic transaction to insert rental and update camera status to 'rented'
      db.serialize(() => {
        db.run('BEGIN TRANSACTION;', (beginErr) => {
          if (beginErr) {
            return res.status(500).json({
              error: 'Failed to initiate transaction.',
              details: beginErr.message
            });
          }

          const insertSql = `
            INSERT INTO rentals (photographer_id, camera_id, rental_date, return_date)
            VALUES (?, ?, ?, ?)
          `;

          db.run(insertSql, [photogId, camId, rDate, retDate], function (insertErr) {
            if (insertErr) {
              return db.run('ROLLBACK;', () => {
                res.status(500).json({
                  error: 'Database error occurred while creating rental record.',
                  details: insertErr.message
                });
              });
            }

            const newRentalId = this.lastID;

            const updateCameraSql = `UPDATE cameras SET status = 'rented' WHERE id = ?`;
            db.run(updateCameraSql, [camId], function (updateErr) {
              if (updateErr) {
                return db.run('ROLLBACK;', () => {
                  res.status(500).json({
                    error: 'Database error occurred while updating camera status.',
                    details: updateErr.message
                  });
                });
              }

              db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                  return db.run('ROLLBACK;', () => {
                    res.status(500).json({
                      error: 'Failed to commit transaction.',
                      details: commitErr.message
                    });
                  });
                }

                res.status(201).json({
                  message: 'Rental created successfully',
                  rental: {
                    id: newRentalId,
                    photographer_id: photogId,
                    photographer_name: photographer.name,
                    camera_id: camId,
                    camera_name: camera.name,
                    camera_kind: camera.kind,
                    rental_date: rDate,
                    return_date: retDate
                  }
                });
              });
            });
          });
        });
      });
    });
  });
});

/**
 * @route   PUT /rentals/:id
 * @desc    Update rental information and maintain camera availability statuses
 * @access  Public
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { photographer_id, camera_id, rental_date, return_date } = req.body;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid rental ID. ID must be a positive integer.'
    });
  }

  if (!photographer_id || isNaN(parseInt(photographer_id, 10)) || parseInt(photographer_id, 10) <= 0) {
    return res.status(400).json({
      error: 'Validation failed: photographer_id is required and must be a positive integer.'
    });
  }

  if (!camera_id || isNaN(parseInt(camera_id, 10)) || parseInt(camera_id, 10) <= 0) {
    return res.status(400).json({
      error: 'Validation failed: camera_id is required and must be a positive integer.'
    });
  }

  const rentalId = parseInt(id, 10);
  const newPhotogId = parseInt(photographer_id, 10);
  const newCamId = parseInt(camera_id, 10);

  // 1. Verify that the rental exists
  db.get('SELECT * FROM rentals WHERE id = ?', [rentalId], (rErr, existingRental) => {
    if (rErr) {
      return res.status(500).json({
        error: 'Database error occurred while verifying rental.',
        details: rErr.message
      });
    }

    if (!existingRental) {
      return res.status(404).json({
        error: `Rental with ID ${rentalId} not found.`
      });
    }

    // 2. Verify that the new photographer exists
    db.get('SELECT id, name FROM photographers WHERE id = ?', [newPhotogId], (pErr, photographer) => {
      if (pErr) {
        return res.status(500).json({
          error: 'Database error occurred while verifying photographer.',
          details: pErr.message
        });
      }

      if (!photographer) {
        return res.status(404).json({
          error: `Photographer with ID ${newPhotogId} not found.`
        });
      }

      // 3. Verify that the new camera exists
      db.get('SELECT id, name, kind, status FROM cameras WHERE id = ?', [newCamId], (cErr, newCamera) => {
        if (cErr) {
          return res.status(500).json({
            error: 'Database error occurred while verifying camera.',
            details: cErr.message
          });
        }

        if (!newCamera) {
          return res.status(404).json({
            error: `Camera with ID ${newCamId} not found.`
          });
        }

        const isChangingCamera = newCamId !== existingRental.camera_id;

        // If changing to another camera, verify the new camera is available
        if (isChangingCamera && newCamera.status !== 'available') {
          return res.status(400).json({
            error: `Camera '${newCamera.name}' is currently ${newCamera.status} and cannot be rented.`
          });
        }

        const rDate = rental_date && typeof rental_date === 'string' && rental_date.trim() !== ''
          ? rental_date.trim()
          : existingRental.rental_date;
        const retDate = return_date !== undefined
          ? (return_date && typeof return_date === 'string' && return_date.trim() !== '' ? return_date.trim() : null)
          : existingRental.return_date;

        // Validate dates
        if (rental_date && !isValidDate(rDate)) {
          return res.status(400).json({
            error: 'Validation failed: rental_date must be a valid date in YYYY-MM-DD format.'
          });
        }

        if (retDate && !isValidDate(retDate)) {
          return res.status(400).json({
            error: 'Validation failed: return_date must be a valid date in YYYY-MM-DD format.'
          });
        }

        if (rDate && retDate && retDate < rDate) {
          return res.status(400).json({
            error: 'Validation failed: return_date cannot be earlier than rental_date.'
          });
        }

        // 4. Execute atomic transaction to update rental and manage camera statuses
        db.serialize(() => {
          db.run('BEGIN TRANSACTION;', (beginErr) => {
            if (beginErr) {
              return res.status(500).json({
                error: 'Failed to initiate transaction.',
                details: beginErr.message
              });
            }

            const updateRentalSql = `
              UPDATE rentals
              SET photographer_id = ?, camera_id = ?, rental_date = ?, return_date = ?
              WHERE id = ?
            `;

            db.run(updateRentalSql, [newPhotogId, newCamId, rDate, retDate, rentalId], function (updateErr) {
              if (updateErr) {
                return db.run('ROLLBACK;', () => {
                  res.status(500).json({
                    error: 'Database error occurred while updating rental.',
                    details: updateErr.message
                  });
                });
              }

              if (isChangingCamera) {
                // Check if the previous camera has any other active rentals
                db.get(
                  'SELECT COUNT(*) AS count FROM rentals WHERE camera_id = ? AND id != ?',
                  [existingRental.camera_id, rentalId],
                  (countErr, countRow) => {
                    if (countErr) {
                      return db.run('ROLLBACK;', () => {
                        res.status(500).json({
                          error: 'Database error checking remaining rentals for previous camera.',
                          details: countErr.message
                        });
                      });
                    }

                    // Release old camera if no other rentals remain
                    const oldCameraStatus = (countRow && countRow.count > 0) ? 'rented' : 'available';

                    db.run('UPDATE cameras SET status = ? WHERE id = ?', [oldCameraStatus, existingRental.camera_id], (oldCamErr) => {
                      if (oldCamErr) {
                        return db.run('ROLLBACK;', () => {
                          res.status(500).json({
                            error: 'Database error updating old camera status.',
                            details: oldCamErr.message
                          });
                        });
                      }

                      // Mark new camera as 'rented'
                      db.run("UPDATE cameras SET status = 'rented' WHERE id = ?", [newCamId], (newCamErr) => {
                        if (newCamErr) {
                          return db.run('ROLLBACK;', () => {
                            res.status(500).json({
                              error: 'Database error updating new camera status.',
                              details: newCamErr.message
                            });
                          });
                        }

                        db.run('COMMIT;', (commitErr) => {
                          if (commitErr) {
                            return db.run('ROLLBACK;', () => {
                              res.status(500).json({
                                error: 'Failed to commit transaction.',
                                details: commitErr.message
                              });
                            });
                          }

                          res.status(200).json({
                            message: 'Rental updated successfully',
                            rental: {
                              id: rentalId,
                              photographer_id: newPhotogId,
                              photographer_name: photographer.name,
                              camera_id: newCamId,
                              camera_name: newCamera.name,
                              camera_kind: newCamera.kind,
                              rental_date: rDate,
                              return_date: retDate
                            }
                          });
                        });
                      });
                    });
                  }
                );
              } else {
                // Camera didn't change; just commit
                db.run('COMMIT;', (commitErr) => {
                  if (commitErr) {
                    return db.run('ROLLBACK;', () => {
                      res.status(500).json({
                        error: 'Failed to commit transaction.',
                        details: commitErr.message
                      });
                    });
                  }

                  res.status(200).json({
                    message: 'Rental updated successfully',
                    rental: {
                      id: rentalId,
                      photographer_id: newPhotogId,
                      photographer_name: photographer.name,
                      camera_id: newCamId,
                      camera_name: newCamera.name,
                      camera_kind: newCamera.kind,
                      rental_date: rDate,
                      return_date: retDate
                    }
                  });
                });
              }
            });
          });
        });
      });
    });
  });
});

/**
 * @route   DELETE /rentals/:id
 * @desc    Delete rental record and update camera status to 'available' if no other active rentals
 * @access  Public
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({
      error: 'Invalid rental ID. ID must be a positive integer.'
    });
  }

  const rentalId = parseInt(id, 10);

  // 1. Verify rental existence
  db.get('SELECT * FROM rentals WHERE id = ?', [rentalId], (rErr, rental) => {
    if (rErr) {
      return res.status(500).json({
        error: 'Database error occurred while verifying rental.',
        details: rErr.message
      });
    }

    if (!rental) {
      return res.status(404).json({
        error: `Rental with ID ${rentalId} not found.`
      });
    }

    const cameraId = rental.camera_id;

    // 2. Perform atomic deletion and camera status update
    db.serialize(() => {
      db.run('BEGIN TRANSACTION;', (beginErr) => {
        if (beginErr) {
          return res.status(500).json({
            error: 'Failed to initiate transaction.',
            details: beginErr.message
          });
        }

        db.run('DELETE FROM rentals WHERE id = ?', [rentalId], function (delErr) {
          if (delErr) {
            return db.run('ROLLBACK;', () => {
              res.status(500).json({
                error: 'Database error occurred while deleting rental.',
                details: delErr.message
              });
            });
          }

          // Check if any remaining rentals reference this camera
          db.get('SELECT COUNT(*) AS count FROM rentals WHERE camera_id = ?', [cameraId], (cntErr, row) => {
            if (cntErr) {
              return db.run('ROLLBACK;', () => {
                res.status(500).json({
                  error: 'Database error checking remaining rentals.',
                  details: cntErr.message
                });
              });
            }

            if (!row || row.count === 0) {
              // No remaining rentals: set status back to 'available'
              db.run("UPDATE cameras SET status = 'available' WHERE id = ?", [cameraId], (updateErr) => {
                if (updateErr) {
                  return db.run('ROLLBACK;', () => {
                    res.status(500).json({
                      error: 'Database error updating camera status to available.',
                      details: updateErr.message
                    });
                  });
                }

                db.run('COMMIT;', (commitErr) => {
                  if (commitErr) {
                    return db.run('ROLLBACK;', () => {
                      res.status(500).json({
                        error: 'Failed to commit transaction.',
                        details: commitErr.message
                      });
                    });
                  }

                  res.status(200).json({
                    message: 'Rental deleted successfully and camera marked as available.',
                    id: rentalId
                  });
                });
              });
            } else {
              // Camera still has other rentals; keep its status
              db.run('COMMIT;', (commitErr) => {
                if (commitErr) {
                  return db.run('ROLLBACK;', () => {
                    res.status(500).json({
                      error: 'Failed to commit transaction.',
                      details: commitErr.message
                    });
                  });
                }

                res.status(200).json({
                  message: 'Rental deleted successfully.',
                  id: rentalId
                });
              });
            }
          });
        });
      });
    });
  });
});

module.exports = router;
