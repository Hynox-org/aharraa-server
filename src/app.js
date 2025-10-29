require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieSession = require('cookie-session');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Cookie session
const sessionSecret = process.env.SESSION_SECRET || 'dev-session-secret';
app.use(
  cookieSession({
    name: 'session',
    keys: [sessionSecret],
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
  })
);

// Swagger setup (runtime)
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aharraa API',
      version: '0.1.0',
      description: 'API documentation for Aharraa server',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 4000}`,
      },
    ],
  },
  // files containing annotations as above
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (req, res) => res.json(swaggerSpec));

// Routes
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Aharraa server running' });
});

module.exports = app;
