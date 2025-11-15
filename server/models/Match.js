const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  spottedReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalReport',
    required: true,
  },
  lostPetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnimalReport',
    required: true,
  },
  ownerId: {
    type: String,
    required: true,
    index: true,
  },
  matchScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  visualSimilarity: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  status: {
    type: String,
    enum: ['pending', 'viewed', 'confirmed', 'dismissed'],
    default: 'pending',
  },
  checked: {
    type: Boolean,
    default: false,
  },
  checkedAt: {
    type: Date,
  },
  notified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});


matchSchema.index({ ownerId: 1, createdAt: -1 });
matchSchema.index({ spottedReportId: 1, lostPetId: 1 }, { unique: true });

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
