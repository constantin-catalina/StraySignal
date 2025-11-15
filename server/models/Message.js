const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true,
  },
  senderId: { type: String, required: true }, 
  text: { type: String, required: true },
  
  readBy: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
});

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
