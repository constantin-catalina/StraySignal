const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' })); // Parse JSON bodies (increased limit for base64 images)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/straysignal';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME; // optional, useful for Atlas when URI doesn't include /dbname

/**
 * Establish a MongoDB connection with retry logic.
 * Removes deprecated options (useNewUrlParser/useUnifiedTopology) which are defaults in Mongoose >=6.
 */
const MAX_RETRIES = 5;
let attempt = 0;

function connectWithRetry() {
  attempt++;
  console.log(`🔌 Attempting MongoDB connection (attempt ${attempt}/${MAX_RETRIES}) ...`);
  const options = {};
  if (MONGODB_DB_NAME) {
    options.dbName = MONGODB_DB_NAME;
    console.log(`🗃  Using database name: ${MONGODB_DB_NAME}`);
  }
  mongoose.connect(MONGODB_URI, options)
    .then(() => {
      console.log('✅ Connected to MongoDB');
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.log(`⏳ Retrying in ${(delay/1000).toFixed(1)}s...`);
        setTimeout(connectWithRetry, delay);
      } else {
        console.error('🚫 Max MongoDB connection attempts reached. Please ensure MongoDB is running or your MONGODB_URI is correct.');
        if (process.platform === 'win32') {
          console.log('💡 Windows tip: Start service with (Admin PowerShell):  net start MongoDB');
          console.log('    Or check status:  sc query MongoDB');
        }
        console.log('💡 If using Atlas, update server/.env with your connection string and whitelist your IP.');
      }
    });
}

// Connection state listeners for better diagnostics
mongoose.connection.on('connected', () => console.log('🟢 Mongoose connected')); 
mongoose.connection.on('error', err => console.error('🔴 Mongoose error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('🟠 Mongoose disconnected')); 
mongoose.connection.on('reconnected', () => console.log('🔁 Mongoose reconnected'));

connectWithRetry();

// Helpful warning if localhost fails quickly (often service not started)
setTimeout(() => {
  if (mongoose.connection.readyState !== 1) {
    console.log('⚠ Still not connected. Verify MongoDB service is running.');
    if (process.platform === 'win32') {
      console.log('   Run as Admin:  net start MongoDB  (service name may be MongoDB or MongoDBServer)');
    }
  }
}, 5000);

// Import models
const AnimalReport = require('./models/AnimalReport');

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// GET all animal reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await AnimalReport.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message,
    });
  }
});

// GET reports near a location (within radius)
app.get('/api/reports/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; // radius in kilometers
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    // Simple distance calculation (you can use MongoDB's $geoNear for more accuracy)
    const reports = await AnimalReport.find();
    
    const nearbyReports = reports.filter(report => {
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        report.latitude,
        report.longitude
      );
      return distance <= radius;
    });

    res.json({
      success: true,
      count: nearbyReports.length,
      data: nearbyReports,
    });
  } catch (error) {
    console.error('Error fetching nearby reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching nearby reports',
      error: error.message,
    });
  }
});

// POST create a new animal report
app.post('/api/reports', async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      time,
      animalType,
      direction,
      injured,
      photos,
      additionalInfo,
      timestamp,
    } = req.body;

    // Validation
    if (!latitude || !longitude || !time || !animalType || injured === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (!photos || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one photo is required',
      });
    }

    // Create new report
    const newReport = new AnimalReport({
      latitude,
      longitude,
      time,
      animalType,
      direction,
      injured,
      photos,
      additionalInfo,
      timestamp: timestamp || new Date(),
    });

    const savedReport = await newReport.save();

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: savedReport,
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating report',
      error: error.message,
    });
  }
});

// GET a single report by ID
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await AnimalReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message,
    });
  }
});

// DELETE a report by ID
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const report = await AnimalReport.findByIdAndDelete(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
      data: report,
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: error.message,
    });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📍 API endpoints available at http://localhost:${PORT}/api`);
});

module.exports = app;
