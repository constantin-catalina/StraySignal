const mongoose = require('mongoose');

const animalReportSchema = new mongoose.Schema({
  latitude: {
    type: Number,
  },
  longitude: {
    type: Number,
  },
  time: {
    type: String,
  },
  animalType: {
    type: String,
    required: true,
  },
  direction: {
    type: String,
    default: '',
  },
  injured: {
    type: Boolean,
  },
  photos: [{
    type: String, // Store photo URIs or base64 strings
  }],
  additionalInfo: {
    type: String,
    default: '',
  },
  reportType: {
    type: String,
    required: true,
    enum: ['lost-from-home', 'spotted-on-streets'],
    default: 'spotted-on-streets',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Optional: Add user info if you want to track who reported
  reportedBy: {
    type: String,
    default: 'anonymous',
  },
  // Lost pet specific fields
  petName: {
    type: String,
  },
  breed: {
    type: String,
  },
  lastSeenLocation: {
    type: String,
  },
  lastSeenDate: {
    type: Date,
  },
  hasReward: {
    type: Boolean,
  },
  hasDistinctiveMarks: {
    type: Boolean,
  },
  distinctiveMarks: {
    type: String,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// Create a 2dsphere index for geospatial queries (useful for finding nearby reports)
animalReportSchema.index({ latitude: 1, longitude: 1 });

const AnimalReport = mongoose.model('AnimalReport', animalReportSchema);

module.exports = AnimalReport;
