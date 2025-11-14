const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [String], // Clerk IDs
    validate: v => Array.isArray(v) && v.length === 2,
    required: true,
    index: true,
  },
  key: {
    type: String, // sorted participants joined, unique pair key
    required: true,
    unique: true,
    index: true,
  },
  lastMessageText: { type: String, default: '' },
  lastSenderId: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  // Track which participants have read the last message (Clerk IDs). Sender is added automatically.
  lastMessageReadBy: { type: [String], default: [] },
  // Optional per-user read cursor (message _id) for future expansion.
  readCursors: { type: Map, of: String, default: {} },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.statics.keyFor = function(a, b) {
  return [a, b].sort().join('#');
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
