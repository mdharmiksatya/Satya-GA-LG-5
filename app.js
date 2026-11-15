// app.js - Main Express Application for LensLab Studio
const express = require('express');

// Import database configuration (initializes SQLite connection, tables, and seed data)
const db = require('./config/db');

// Import route modules
const photographersRouter = require('./routes/photographers');
const camerasRouter = require('./routes/cameras');
const rentalsRouter = require('./routes/rentals');

// Initialize the Express application
const app = express();

// Set the port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Built-in middleware to parse incoming requests with JSON payloads
app.use(express.json());

// Basic root route returning a welcome message in JSON format
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to LensLab Studio – Camera Rental Management System API',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
app.use('/photographers', photographersRouter);
app.use('/cameras', camerasRouter);
app.use('/rentals', rentalsRouter);

// Start the Express server and listen on the configured port
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the API at http://localhost:${PORT}`);
});

module.exports = app;
