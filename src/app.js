const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Collaborative Document Store API' });
});

// API Routes
app.use(routes);

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
