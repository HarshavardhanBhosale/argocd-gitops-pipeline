const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDbSessionStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const errorController = require('./controllers/error');
const User = require('./models/user');
const { forwardError } = require('./utils');

// FIX 1: Detect if using fallback or explicit SRV string, and cleanly transform it to standard format
let MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  // If fallback env variables are used, construct the standard connection string to bypass SRV lookup
  const user = process.env.MONGO_USER || '';
  const pwd = process.env.MONGO_PWD || '';
  const db = process.env.MONGO_DB || '';
  
  // Standard format using the explicit fallback shard addresses for cluster0-hcscb
  MONGODB_URI = `mongodb://${user}:${pwd}@cluster0-shard-00-00.hcscb.mongodb.net:27017,cluster0-shard-00-01.hcscb.mongodb.net:27017,cluster0-shard-00-02.hcscb.mongodb.net:27017/${db}?ssl=true&replicaSet=atlas-hcscb-shard-0&authSource=admin&retryWrites=true&w=majority`;
} else if (MONGODB_URI.startsWith('mongodb+srv://')) {
  // If your provided string has +srv, warning provided since your environment cannot resolve it
  console.warn("WARNING: SRV connection string detected. If DNS fails, replace it with the standard mongodb:// connection string from Atlas.");
}

const app = express();

// FIX 2: Initialize store with the safe URI string
const store = new MongoDbSessionStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});

// FIX 3: Intercept and handle errors cleanly to prevent Node.js from throwing an unhandled exception
store.on('error', function(error) {
  console.error('Session Store Network/DNS Error:', error.message);
});

// Multer configs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image.jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set('view engine', 'ejs');
app.set('views', 'views');

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'),
  { flags: 'a' }
);

app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: accessLogStream }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ storage, fileFilter }).single('image'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use(session({
  secret: 'my secret',
  resave: false,
  saveUninitialized: false,
  store: store
}));
app.use(csrf());
app.use(flash());

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then(user => {
      if (!user) {
        next();
      }
      req.user = user;
      next();
    })
    .catch(err => forwardError(err, next));
});

app.get('/health', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'UP', database: 'CONNECTED' });
  }
  return res.status(503).json({ status: 'DOWN', database: 'DISCONNECTED' });
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

// Page Not Found Error Middleware
app.use(errorController.get404);

app.use((error, req, res, next) => {
  console.error("Actual App Error:", error);
  res.status(500).render('500', {
    pageTitle: 'Error!',
    path: '/500',
    isAuthenticated: req.session ? req.session.isLoggedIn : false
  });
});

// Connect via Mongoose using the connection parameters
mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Successfully connected to MongoDB...');
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Listening to port ${port}...`);
    });
  })
  .catch((err) => {
    console.error('Mongoose Initial Connection Failed:', err.message);
  });

const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('Mongoose connection disconnected.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
