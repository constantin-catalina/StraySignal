const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME; 

if (!MONGODB_URI) {
  console.error('\nMissing MONGODB_URI environment variable.');
  console.error('   Add it to server/.env or your deployment environment.');
  console.error('   Example Atlas URI: mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/StraySignal?retryWrites=true&w=majority');
  process.exit(1);
}


const MAX_RETRIES = 5;
let attempt = 0;

function connectWithRetry() {
  attempt++;
  console.log(`[DB] Attempt ${attempt}/${MAX_RETRIES} connecting to mongodb`);
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


mongoose.connection.on('connected', () => console.log('Mongoose connected')); 
mongoose.connection.on('error', err => console.error('Mongoose error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('Mongoose disconnected')); 
mongoose.connection.on('reconnected', () => console.log('Mongoose reconnected'));

connectWithRetry();


setTimeout(() => {
  if (mongoose.connection.readyState !== 1) {
  console.log('Still not connected. Verify MongoDB service is running.');
    if (process.platform === 'win32') {
      console.log('   Run as Admin:  net start MongoDB  (service name may be MongoDB or MongoDBServer)');
    }
  }
}, 5000);


const AnimalReport = require('./models/AnimalReport');
const User = require('./models/User');
const Match = require('./models/Match');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const mlService = require('./ml-service');





app.post('/api/chat/open', async (req, res) => {
  try {
    const { userId, peerId } = req.body;
    if (!userId || !peerId || userId === peerId) {
      return res.status(400).json({ success: false, message: 'Invalid user IDs' });
    }
    const key = [userId, peerId].sort().join('#');
    let convo = await Conversation.findOne({ key });
    if (!convo) {
      convo = await Conversation.create({ participants: [userId, peerId], key });
    }
    res.json({ success: true, data: { conversationId: convo._id } });
  } catch (error) {
    console.error('Error opening conversation:', error);
    res.status(500).json({ success: false, message: 'Error opening conversation', error: error.message });
  }
});


app.get('/api/chat/conversations', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
    const convos = await Conversation.find({ participants: userId }).sort({ lastMessageAt: -1 }).limit(100);
    const result = await Promise.all(convos.map(async c => {
      const peerId = c.participants.find(p => p !== userId);
      const peer = await User.findOne({ clerkId: peerId });
      return {
        _id: c._id,
        participants: c.participants,
        peer: peer ? { id: peer.clerkId, name: peer.name, profileImage: peer.profileImage } : { id: peerId },
        lastMessageText: c.lastMessageText,
        lastSenderId: c.lastSenderId,
        lastMessageAt: c.lastMessageAt,
      };
    }));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing conversations:', error);
    res.status(500).json({ success: false, message: 'Error listing conversations', error: error.message });
  }
});


app.get('/api/chat/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const msgs = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(300);
    res.json({ success: true, data: msgs });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages', error: error.message });
  }
});


app.post('/api/chat/messages', async (req, res) => {
  try {
    const { conversationId, senderId, text } = req.body;
    if (!conversationId || !senderId || !text) {
      return res.status(400).json({ success: false, message: 'conversationId, senderId, text required' });
    }
    const msg = await Message.create({ conversationId, senderId, text: String(text).trim() });
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageText: text,
      lastSenderId: senderId,
      lastMessageAt: new Date(),
    });
    res.status(201).json({ success: true, data: msg });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
  }
});


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});




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

    
    let user = await User.findOne({ clerkId });

    if (user) {
      
      user.name = name;
      user.phone = phone !== undefined ? phone : user.phone;
      user.location = location !== undefined ? location : user.location;
      user.profileImage = profileImage !== undefined ? profileImage : user.profileImage;
      user.showPhoneNumber = showPhoneNumber !== undefined ? showPhoneNumber : user.showPhoneNumber;
      user.radiusPreference = radiusPreference !== undefined ? radiusPreference : user.radiusPreference;
      
      
      if (user.email !== email) {
        
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




app.get('/api/reports', async (req, res) => {
  try {
    const reports = await AnimalReport.find().sort({ createdAt: -1 });
    
    
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


app.get('/api/reports/nearby', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; 
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    
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


app.put('/api/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
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
        
        if (key === 'lastSeenDate' && req.body[key]) {
          updates[key] = new Date(req.body[key]);
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    
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


function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
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




mlService.initializeBaseModel().catch(err => {
  console.error('Failed to initialize ML model:', err);
  console.warn('ML matching will not be available');
});


app.post('/api/matches/process/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    console.log('========================================');
    console.log('Processing ML matches for report:', reportId);
    
    
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

    
    if (spottedReport.reportType !== 'spotted-on-streets') {
      console.log('ERROR: Not a spotted-on-streets report');
      return res.status(400).json({
        success: false,
        message: 'Only spotted-on-streets reports can be processed for matching',
      });
    }

    
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
    
    const matches = await mlService.findMatches(spottedReport.toObject(), lostPets.map(p => p.toObject()), 75);
    console.log(`ML matching complete. Found ${matches.length} matches above threshold`);
    
    
    const savedMatches = [];
    for (const match of matches) {
      try {
        console.log(`Saving match: score=${match.matchScore}%, pet=${match.lostPetName}, owner=${match.ownerId}`);
        
        
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


app.post('/api/matches/reprocess-all', async (req, res) => {
  try {
    console.log('========================================');
    console.log('REPROCESSING ALL SPOTTED REPORTS');
    console.log('========================================');
    
    
    const spottedReports = await AnimalReport.find({ reportType: 'spotted-on-streets' });
    console.log(`Found ${spottedReports.length} spotted reports to reprocess`);
    
    if (spottedReports.length === 0) {
      return res.json({
        success: true,
        message: 'No spotted reports to reprocess',
        stats: { processed: 0, matchesCreated: 0, matchesUpdated: 0 },
      });
    }
    
    
    const lostPets = await AnimalReport.find({ reportType: 'lost-from-home' });
    console.log(`Found ${lostPets.length} lost pet reports to compare against`);
    
    if (lostPets.length === 0) {
      return res.json({
        success: true,
        message: 'No lost pets to compare against',
        stats: { processed: spottedReports.length, matchesCreated: 0, matchesUpdated: 0 },
      });
    }
    
    let totalProcessed = 0;
    let totalMatchesCreated = 0;
    let totalMatchesUpdated = 0;
    
    
    for (const spottedReport of spottedReports) {
      try {
        console.log(`\nProcessing report ${spottedReport._id}...`);
        
        
        const matches = await mlService.findMatches(
          spottedReport.toObject(),
          lostPets.map(p => p.toObject()),
          75
        );
        
        console.log(`Found ${matches.length} matches for this report`);
        
        
        for (const match of matches) {
          const existing = await Match.findOne({
            spottedReportId: match.spottedReportId,
            lostPetId: match.lostPetId,
          });
          
          if (existing) {
            
            await Match.findByIdAndUpdate(existing._id, {
              matchScore: match.matchScore,
              visualSimilarity: match.visualSimilarity,
            });
            totalMatchesUpdated++;
            console.log(`Updated match ${existing._id}: ${match.matchScore}%`);
          } else {
            
            const newMatch = new Match({
              spottedReportId: match.spottedReportId,
              lostPetId: match.lostPetId,
              ownerId: match.ownerId,
              matchScore: match.matchScore,
              visualSimilarity: match.visualSimilarity,
              status: 'pending',
              notified: false,
            });
            await newMatch.save();
            totalMatchesCreated++;
            console.log(`Created new match: ${match.matchScore}%`);
          }
        }
        
        totalProcessed++;
      } catch (error) {
        console.error(`Error processing report ${spottedReport._id}:`, error);
        
      }
    }
    
    console.log('\n========================================');
    console.log('REPROCESSING COMPLETE');
    console.log(`Processed: ${totalProcessed} reports`);
    console.log(`Created: ${totalMatchesCreated} new matches`);
    console.log(`Updated: ${totalMatchesUpdated} existing matches`);
    console.log('========================================');
    
    res.json({
      success: true,
      message: 'Reprocessing complete',
      stats: {
        processed: totalProcessed,
        matchesCreated: totalMatchesCreated,
        matchesUpdated: totalMatchesUpdated,
      },
    });
  } catch (error) {
    console.error('Error reprocessing matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error reprocessing matches',
      error: error.message,
    });
  }
});




const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  console.log(`[Socket.IO] New connection: socketId=${socket.id}, userId=${userId}`);
  if (userId) {
    socket.join(`user:${userId}`);
  }

  
  async function emitConversationUpdate(convoId) {
    const convo = await Conversation.findById(convoId);
    if (!convo) return;
    for (const pid of convo.participants) {
      const peerId = convo.participants.find(p => p !== pid);
      const peer = await User.findOne({ clerkId: peerId });
      const unreadCount = await Message.countDocuments({
        conversationId: convoId,
        senderId: { $ne: pid },
        readBy: { $ne: pid }
      });
      io.to(`user:${pid}`).emit('chat:conversation:update', {
        _id: convo._id,
        participants: convo.participants,
        peer: peer ? { id: peer.clerkId, name: peer.name, profileImage: peer.profileImage } : { id: peerId },
        lastMessageText: convo.lastMessageText,
        lastSenderId: convo.lastSenderId,
        lastMessageAt: convo.lastMessageAt,
        lastMessageReadBy: convo.lastMessageReadBy || [],
        unreadCount,
      });
    }
  }

  socket.on('chat:list', async () => {
    if (!userId) return;
    const convos = await Conversation.find({ participants: userId }).sort({ lastMessageAt: -1 }).limit(100);
    const payload = await Promise.all(convos.map(async c => {
      const peerId = c.participants.find(p => p !== userId);
      const peer = await User.findOne({ clerkId: peerId });
      const unreadCount = await Message.countDocuments({
        conversationId: c._id,
        senderId: { $ne: userId },
        readBy: { $ne: userId }
      });
      return {
        _id: c._id,
        participants: c.participants,
        peer: peer ? { id: peer.clerkId, name: peer.name, profileImage: peer.profileImage } : { id: peerId },
        lastMessageText: c.lastMessageText,
        lastSenderId: c.lastSenderId,
        lastMessageAt: c.lastMessageAt,
        lastMessageReadBy: c.lastMessageReadBy || [],
        unreadCount,
      };
    }));
    socket.emit('chat:conversations', payload);
  });

  socket.on('chat:open', async ({ peerId }) => {
    if (!userId || !peerId || userId === peerId) return;
    const key = [userId, peerId].sort().join('#');
    let convo = await Conversation.findOne({ key });
    if (!convo) convo = await Conversation.create({ participants: [userId, peerId], key });
    socket.emit('chat:opened', { conversationId: convo._id });
    emitConversationUpdate(convo._id);
  });

  socket.on('chat:join', async ({ conversationId }) => {
    console.log(`[chat:join] userId=${userId} joining convo:${conversationId}`);
    socket.join(`convo:${conversationId}`);
    socket.emit('chat:joined', { conversationId });
  });

  socket.on('chat:history', async ({ conversationId }) => {
    const msgs = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(300);
    socket.emit('chat:history', { conversationId, messages: msgs });
  });

  socket.on('chat:send', async ({ conversationId, text }) => {
    if (!userId || !conversationId || !text) return;
    const trimmed = String(text).trim();
    const msg = await Message.create({ conversationId, senderId: userId, text: trimmed, readBy: [userId] });
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageText: msg.text,
      lastSenderId: userId,
      lastMessageAt: new Date(),
      lastMessageReadBy: [userId],
      [`readCursors.${userId}`]: msg._id.toString(),
    });
    io.to(`convo:${conversationId}`).emit('chat:message', msg);
    emitConversationUpdate(conversationId);
  });

  
  socket.on('chat:typing', ({ conversationId, isTyping }) => {
    if (!userId || !conversationId) return;
    socket.to(`convo:${conversationId}`).emit('chat:typing', { conversationId, userId, isTyping: !!isTyping });
  });

  
  socket.on('chat:read', async ({ conversationId, messageId }) => {
    if (!userId || !conversationId || !messageId) return;
    const msg = await Message.findOne({ _id: messageId, conversationId });
    if (!msg) return;
    if (!msg.readBy.includes(userId)) {
      msg.readBy.push(userId);
      await msg.save();
    }
    
    const convo = await Conversation.findById(conversationId);
    if (convo && convo.lastMessageAt && msg._id.toString() === convo.readCursors.get(convo.lastSenderId) || msg.text === convo.lastMessageText) {
      if (!convo.lastMessageReadBy.includes(userId)) {
        convo.lastMessageReadBy.push(userId);
        convo.readCursors.set(userId, msg._id.toString());
        await convo.save();
      }
    }
    
    emitConversationUpdate(conversationId);
    io.to(`convo:${conversationId}`).emit('chat:read', { conversationId, messageId, userId });
  });

  
  socket.on('chat:delete', async ({ conversationId, messageId }) => {
    try {
      console.log(`[chat:delete] userId=${userId}, conversationId=${conversationId}, messageId=${messageId}`);
      if (!userId || !conversationId || !messageId) {
        console.log('[chat:delete] Missing required fields');
        return;
      }
      const msg = await Message.findOne({ _id: messageId, conversationId });
      if (!msg) {
        console.log('[chat:delete] Message not found');
        return;
      }
      if (msg.senderId !== userId) {
        console.log(`[chat:delete] Permission denied: msg.senderId=${msg.senderId} !== userId=${userId}`);
        return;
      }
      
      console.log(`[chat:delete] Deleting message ${messageId}`);
      await Message.deleteOne({ _id: messageId });
      console.log(`[chat:delete] Message deleted from database`);
      
      
      const convo = await Conversation.findById(conversationId);
      if (convo && convo.lastMessageText === msg.text) {
        const lastMsg = await Message.findOne({ conversationId }).sort({ createdAt: -1 });
        if (lastMsg) {
          convo.lastMessageText = lastMsg.text;
          convo.lastSenderId = lastMsg.senderId;
          convo.lastMessageAt = lastMsg.createdAt;
          convo.lastMessageReadBy = lastMsg.readBy || [];
        } else {
          convo.lastMessageText = '';
          convo.lastSenderId = undefined;
          convo.lastMessageAt = undefined;
          convo.lastMessageReadBy = [];
        }
        await convo.save();
        emitConversationUpdate(conversationId);
      }
      
      console.log(`[chat:delete] Emitting chat:deleted event to room convo:${conversationId}`);
      io.to(`convo:${conversationId}`).emit('chat:deleted', { conversationId, messageId });
      console.log(`[chat:delete] Event emitted successfully`);
    } catch (error) {
      console.error('[chat:delete] Error:', error);
    }
  });

  socket.on('disconnect', () => {
    
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server + Socket.IO listening on port ${PORT}`);
});


process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

module.exports = app;
