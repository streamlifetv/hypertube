import express from 'express';
import compression from 'compression';
import session from 'express-session';
import bodyParser from 'body-parser';
import logger from 'morgan';
import chalk from 'chalk';
import errorHandler from 'errorhandler';
import lusca from 'lusca';
import path from 'path';
import mongoose from 'mongoose';
import passport from 'passport';
import expressValidator from 'express-validator';
import expressStatusMonitor from 'express-status-monitor';
import multer from 'multer';
import dotenv from 'dotenv/config';

import routes from './routes';

// stores sessions in the "sessions" collection by default. See if user is loggedin (passport).
const MongoStore = require('connect-mongo')(session);

/**
 * multer configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, 'public/uploads/tmp'));
  },
  filename: (req, file, callback) => {
    callback(null, Date.now() + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
});
/**
 * Create Express server.
 */
const app = express();

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise; // Use native promises (vs bluebird...) (?)
mongoose.connect(process.env.MONGODB_URI, { useMongoClient: true });
mongoose.connection.on('error', (err) => {
  console.error(err);
  console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
  process.exit();
});

/**
 * Express configuration.
 */
app.set('host', process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0');
app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8000);
app.use(expressStatusMonitor()); // report realtime server metrics for Express-based node servers ?
app.use(compression()); // reduce page loads time to the order of 15-20%
app.use(logger('dev')); // morgan
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressValidator()); // validate form inputs. cf req.assert in controllers files
// express-session: sends a session ID over cookies to the client
app.use(session({
  resave: true, // automatically write to the session store
  saveUninitialized: true, // saved new sessions
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    url: process.env.MONGODB_URI,
    autoReconnect: true,
    clear_interval: 3600
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(lusca.xframe('SAMEORIGIN')); // lusca = security middleware
app.use(lusca.xssProtection(true));

// Load routes
routes(app, upload);

/**
 * Error Handler. only use in development
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('%s App is running at http://localhost:%d in %s mode', chalk.green('✓'), app.get('port'), app.get('env'));
  console.log('  Press CTRL-C to stop\n');
});

module.exports = app;
