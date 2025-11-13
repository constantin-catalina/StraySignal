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

// MongoDB Connection (Atlas or local)
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME; // optional if URI does not include a db name

if (!MONGODB_URI) {
  console.error('\nMissing MONGODB_URI environment variable.');
  console.error('   Add it to server/.env or your deployment environment.');
  console.error('   Example Atlas URI: mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/StraySignal?retryWrites=true&w=majority');
  process.exit(1);
}

/**
 * Establish a MongoDB connection with retry logic.
 * Removes deprecated options (useNewUrlParser/useUnifiedTopology) which are defaults in Mongoose >=6.
 */
const MAX_RETRIES = 5;
let attempt = 0;

function sanitize(uri) {
  // Hide credentials for logging
  return uri.replace(/:\w+@/, ':****@');
}

function connectWithRetry() {
  attempt++;
  console.log(`[DB] Attempt ${attempt}/${MAX_RETRIES} connecting to ${sanitize(MONGODB_URI)}${MONGODB_DB_NAME ? ' (dbName override: ' + MONGODB_DB_NAME + ')' : ''}`);
  const options = {};
  if (MONGODB_DB_NAME) options.dbName = MONGODB_DB_NAME;
  mongoose.connect(MONGODB_URI, options)
    .then(() => {
      console.log('MongoDB connection established');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
      if (attempt < MAX_RETRIES) {
        const delay = attempt * 2000;
        console.log(`Retrying in ${(delay/1000).toFixed(1)}s...`);
        setTimeout(connectWithRetry, delay);
      } else {
        console.error('Max retries reached. Verify network access / IP whitelist (Atlas) and credentials.');
      }
    });
}

// Connection state listeners for better diagnostics
mongoose.connection.on('connected', () => console.log('Mongoose connected')); 
mongoose.connection.on('error', err => console.error('Mongoose error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('Mongoose disconnected')); 
mongoose.connection.on('reconnected', () => console.log('Mongoose reconnected'));

connectWithRetry();

// Helpful warning if localhost fails quickly (often service not started)
setTimeout(() => {
  if (mongoose.connection.readyState !== 1) {
  console.log('Still not connected. Verify MongoDB service is running.');
    if (process.platform === 'win32') {
      console.log('   Run as Admin:  net start MongoDB  (service name may be MongoDB or MongoDBServer)');
    }
  }
}, 5000);

// Import models
const AnimalReport = require('./models/AnimalReport');
const User = require('./models/User');
const Match = require('./models/Match');
const mlService = require('./ml-service');

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// ============ USER PROFILE ENDPOINTS ============

// GET user profile by Clerk ID
app.get('/api/users/:clerkId', async (req, res) => {
  try {
    const { clerkId } = req.params;
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message,
    });
  }
});

// POST create or update user profile
app.post('/api/users', async (req, res) => {
  try {
    const {
      clerkId,
      name,
      email,
      phone,
      location,
      profileImage,
      showPhoneNumber,
      radiusPreference,
    } = req.body;

    console.log('POST /api/users received:', { clerkId, name, email, phone, location, showPhoneNumber, radiusPreference });

    if (!clerkId || !name || !email) {
      return res.status(400).json({
        success: false,
        message: 'clerkId, name, and email are required',
      });
    }

    // Find existing user or create new one
    let user = await User.findOne({ clerkId });

    if (user) {
      // Update existing user
      user.name = name;
      user.phone = phone !== undefined ? phone : user.phone;
      user.location = location !== undefined ? location : user.location;
      user.profileImage = profileImage !== undefined ? profileImage : user.profileImage;
      user.showPhoneNumber = showPhoneNumber !== undefined ? showPhoneNumber : user.showPhoneNumber;
      user.radiusPreference = radiusPreference !== undefined ? radiusPreference : user.radiusPreference;
      
      // Only update email if it's different to avoid duplicate key error
      if (user.email !== email) {
        // Check if another user already has this email
        const emailExists = await User.findOne({ email, clerkId: { $ne: clerkId } });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use by another account',
          });
        }
        user.email = email;
      }
      
      try {
        await user.save();
        console.log('User updated successfully:', user._id);
      } catch (saveError) {
        // Handle duplicate key errors
        if (saveError.code === 11000) {
          console.error('Duplicate key error during save:', saveError);
          return res.status(400).json({
            success: false,
            message: 'Email already exists in another account. Cannot update.',
            error: saveError.message,
          });
        }
        throw saveError;
      }
    } else {
      // Create new user
      user = new User({
        clerkId,
        name,
        email,
        phone: phone || '',
        location: location || '',
        profileImage: profileImage || '',
        showPhoneNumber: showPhoneNumber || false,
        radiusPreference: radiusPreference || 2,
      });
      await user.save();
      console.log('New user created:', user._id);
    }

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error saving user:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    res.status(500).json({
      success: false,
      message: 'Error saving user',
      error: error.message,
    });
  }
});

// PUT update user profile
app.put('/api/users/:clerkId', async (req, res) => {
  try {
    const { clerkId } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { clerkId },
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message,
    });
  }
});

// ============ ANIMAL REPORT ENDPOINTS ============

// GET all animal reports
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await AnimalReport.find().sort({ createdAt: -1 });
    
    // For lost-from-home reports, include the owner's phone visibility preference
    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const reportObj = report.toObject();
        if (report.reportType === 'lost-from-home' && report.reportedBy) {
          try {
            const owner = await User.findOne({ clerkId: report.reportedBy });
            if (owner) {
              reportObj.ownerShowsPhone = owner.showPhoneNumber;
            }
          } catch (err) {
            console.error('Error fetching owner data:', err);
          }
        }
        return reportObj;
      })
    );
    
    res.json({
      success: true,
      count: enrichedReports.length,
      data: enrichedReports,
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

    // Create new report, ensure reportedBy is set
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
      reportedBy: req.body.reportedBy || 'anonymous',
    });

    console.log('Creating report with reportedBy:', req.body.reportedBy);

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

// POST create a lost pet report
app.post('/api/reports/lost-pet', async (req, res) => {
  try {
    const {
      petName,
      animalType,
      breed,
      lastSeenLocation,
      lastSeenDate,
      latitude,
      longitude,
      hasReward,
      hasDistinctiveMarks,
      distinctiveMarks,
      additionalInfo,
      photos,
      reportedBy,
    } = req.body;

    // Validation
    if (!petName || !animalType || !lastSeenLocation || !lastSeenDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: petName, animalType, lastSeenLocation, lastSeenDate',
      });
    }

    if (!photos || photos.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two photos are required',
      });
    }

    // Create new lost pet report
    const newReport = new AnimalReport({
      petName,
      animalType,
      breed,
      lastSeenLocation,
      lastSeenDate: new Date(lastSeenDate),
      latitude,
      longitude,
      hasReward,
      hasDistinctiveMarks,
      distinctiveMarks,
      additionalInfo,
      photos,
      reportType: 'lost-from-home',
      reportedBy: reportedBy || 'anonymous',
      timestamp: new Date(),
    });

    const savedReport = await newReport.save();

    res.status(201).json({
      success: true,
      message: 'Lost pet report created successfully',
      data: savedReport,
    });
  } catch (error) {
    console.error('Error creating lost pet report:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating lost pet report',
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

    const reportObj = report.toObject();
    
    // For lost-from-home reports, include the owner's phone visibility preference
    if (report.reportType === 'lost-from-home' && report.reportedBy) {
      try {
        const owner = await User.findOne({ clerkId: report.reportedBy });
        if (owner) {
          reportObj.ownerShowsPhone = owner.showPhoneNumber;
        }
      } catch (err) {
        console.error('Error fetching owner data:', err);
      }
    }

    res.json({
      success: true,
      data: reportObj,
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

// PUT update an existing animal report (primarily for lost pet posters)
app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Allow updating a subset of fields; ignore unknown keys silently
    const allowedFields = [
      'petName',
      'animalType',
      'breed',
      'lastSeenLocation',
      'lastSeenDate',
      'hasReward',
      'hasDistinctiveMarks',
      'distinctiveMarks',
      'additionalInfo'
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        // Special handling for date field
        if (key === 'lastSeenDate' && req.body[key]) {
          updates[key] = new Date(req.body[key]);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    // Debug log to verify the route is hit and what's being updated
    console.log(`[PUT] /api/reports/${id}`, { keys: Object.keys(updates) });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    const updated = await AnimalReport.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ success: false, message: 'Error updating report', error: error.message });
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

// ============ ML MATCHING ENDPOINTS ============

// Initialize ML model on server start
mlService.initializeModel().catch(err => {
  console.error('Failed to initialize ML model:', err);
  console.warn('ML matching will not be available');
});

// Process matches for a newly spotted animal report
app.post('/api/matches/process/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log('========================================');
    console.log('Processing ML matches for report:', reportId);
    
    // Get the spotted report
    const spottedReport = await AnimalReport.findById(reportId);
    if (!spottedReport) {
      console.log('ERROR: Spotted report not found');
      return res.status(404).json({
        success: false,
        message: 'Spotted report not found',
      });
    }

    console.log('Spotted report found:', {
      id: spottedReport._id,
      type: spottedReport.reportType,
      animalType: spottedReport.animalType,
      photos: spottedReport.photos?.length || 0,
    });

    // Only process spotted-on-streets reports
    if (spottedReport.reportType !== 'spotted-on-streets') {
      console.log('ERROR: Not a spotted-on-streets report');
      return res.status(400).json({
        success: false,
        message: 'Only spotted-on-streets reports can be processed for matching',
      });
    }

    // Get all lost-from-home reports
    const lostPets = await AnimalReport.find({ reportType: 'lost-from-home' });
    console.log(`Found ${lostPets.length} lost pet reports to compare`);
    
    if (lostPets.length === 0) {
      console.log('No lost pets to compare');
      return res.json({
        success: true,
        message: 'No lost pets to compare',
        matches: [],
      });
    }

    console.log('Starting ML matching...');
    // Find matches using ML
    const matches = await mlService.findMatches(spottedReport.toObject(), lostPets.map(p => p.toObject()), 75);
    console.log(`ML matching complete. Found ${matches.length} matches above threshold`);
    
    // Save matches to database
    const savedMatches = [];
    for (const match of matches) {
      try {
        console.log(`Saving match: score=${match.matchScore}%, pet=${match.lostPetName}, owner=${match.ownerId}`);
        
        // Check if match already exists
        const existing = await Match.findOne({
          spottedReportId: match.spottedReportId,
          lostPetId: match.lostPetId,
        });

        if (!existing) {
          const newMatch = new Match({
            spottedReportId: match.spottedReportId,
            lostPetId: match.lostPetId,
            ownerId: match.ownerId,
            matchScore: match.matchScore,
            visualSimilarity: match.visualSimilarity,
            status: 'pending',
            notified: false,
          });
          
          const saved = await newMatch.save();
          savedMatches.push(saved);
          console.log(`Match saved with ID: ${saved._id}`);
        } else {
          console.log('Match already exists, skipping');
        }
      } catch (error) {
        console.error('Error saving match:', error);
        // Continue with other matches
      }
    }

    console.log(`Saved ${savedMatches.length} new matches to database`);
    console.log('========================================');
    
    res.json({
      success: true,
      message: `Found ${matches.length} matches, saved ${savedMatches.length} new matches`,
      matches: savedMatches,
    });
  } catch (error) {
    console.error('Error processing matches:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error processing matches',
      error: error.message,
    });
  }
});

// Get matches for a specific user (for inbox/notifications)
app.get('/api/matches/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    console.log(`Fetching matches for user: ${userId}`);

    const query = { ownerId: userId };
    if (status) {
      query.status = status;
    }

    const matches = await Match.find(query)
      .populate('spottedReportId')
      .populate('lostPetId')
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`Found ${matches.length} matches for user ${userId}`);

    res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error('Error fetching user matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching matches',
      error: error.message,
    });
  }
});

// Update match status
app.patch('/api/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status, checked } = req.body;

    console.log('PATCH /api/matches/:matchId called');
    console.log('Match ID:', matchId);
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Status value:', status, 'Type:', typeof status);
    console.log('Checked value:', checked, 'Type:', typeof checked);

    const updateData = {};
    
    if (status !== undefined && status !== null) {
      if (!['pending', 'viewed', 'confirmed', 'dismissed'].includes(status)) {
        console.log('Invalid status value received:', status);
        return res.status(400).json({
          success: false,
          message: `Invalid status value: ${status}`,
        });
      }
      updateData.status = status;
    }

    if (checked !== undefined && checked !== null) {
      updateData.checked = checked;
      if (checked) {
        updateData.checkedAt = new Date();
      }
    }

    console.log('Update data:', updateData);

    const match = await Match.findByIdAndUpdate(
      matchId,
      updateData,
      { new: true }
    );

    console.log('Match found:', match ? 'Yes' : 'No');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    console.log('Match updated successfully');
    res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating match',
      error: error.message,
    });
  }
});

// Compare two specific images (for testing)
app.post('/api/matches/compare', async (req, res) => {
  try {
    const { image1, image2 } = req.body;

    if (!image1 || !image2) {
      return res.status(400).json({
        success: false,
        message: 'Both image1 and image2 are required',
      });
    }

    const matchScore = await mlService.compareImages(image1, image2);

    res.json({
      success: true,
      matchScore,
    });
  } catch (error) {
    console.error('Error comparing images:', error);
    res.status(500).json({
      success: false,
      message: 'Error comparing images',
      error: error.message,
    });
  }
});

// Start server
// Listen on 0.0.0.0 to accept connections from all network interfaces (container / host / cloud dyno)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

// Global error safety nets
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

module.exports = app;
