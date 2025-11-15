const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: {
    type: [String], 
    validate: v => Array.isArray(v) && v.length === 2,
    required: true,
    index: true,
  },
  key: {
    type: String, 
    required: true,
    unique: true,
    index: true,
  },
  lastMessageText: { type: String, default: '' },
  lastSenderId: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  
  lastMessageReadBy: { type: [String], default: [] },
  
  readCursors: { type: Map, of: String, default: {} },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.statics.keyFor = function(a, b) {
  return [a, b].sort().join('#');
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
