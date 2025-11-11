const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

async function cleanupDuplicates() {
  try {
    const options = {};
    if (MONGODB_DB_NAME) options.dbName = MONGODB_DB_NAME;
    
    await mongoose.connect(MONGODB_URI, options);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    // Group by email
    const emailMap = new Map();
    users.forEach(user => {
      if (!emailMap.has(user.email)) {
        emailMap.set(user.email, []);
      }
      emailMap.get(user.email).push(user);
    });

    // Find duplicates
    const duplicates = Array.from(emailMap.entries()).filter(([_, users]) => users.length > 1);
    
    console.log(`\nFound ${duplicates.length} duplicate emails:`);
    
    for (const [email, dupeUsers] of duplicates) {
      console.log(`\n${email}: ${dupeUsers.length} accounts`);
      dupeUsers.forEach((u, i) => {
        console.log(`  ${i + 1}. ClerkId: ${u.clerkId}, Name: ${u.name}, Created: ${u.createdAt}`);
      });
      
      // Keep the most recently created one, delete others
      dupeUsers.sort((a, b) => b.createdAt - a.createdAt);
      const toKeep = dupeUsers[0];
      const toDelete = dupeUsers.slice(1);
      
      console.log(`   Keeping: ${toKeep.clerkId} (${toKeep.name})`);
      console.log(`   Deleting: ${toDelete.map(u => u.clerkId).join(', ')}`);
      
      for (const user of toDelete) {
        await User.deleteOne({ _id: user._id });
        console.log(`     Deleted ${user.clerkId}`);
      }
    }

    console.log('\nCleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
