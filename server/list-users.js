const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

async function listUsers() {
  try {
    const options = {};
    if (MONGODB_DB_NAME) options.dbName = MONGODB_DB_NAME;
    
    await mongoose.connect(MONGODB_URI, options);
    console.log('Connected to MongoDB\n');

    const users = await User.find({});
    console.log(`Total users: ${users.length}\n`);

    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   ClerkId: ${user.clerkId}`);
      console.log(`   Phone: ${user.phone || '(not set)'}`);
      console.log(`   Location: ${user.location || '(not set)'}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsers();
