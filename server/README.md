# StraySignal Backend Server

This is the backend API server for the StraySignal mobile app, built with Express.js and MongoDB.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)

## Setup Instructions

### Option 1: Local MongoDB (Recommended for Development)

1. **Install MongoDB locally:**
   - Windows: Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Mac: `brew install mongodb-community`
   - Linux: Follow instructions at https://docs.mongodb.com/manual/administration/install-on-linux/

2. **Start MongoDB service:**
   ```bash
   # Windows (run as Administrator)
   net start MongoDB
   
   # Mac/Linux
   brew services start mongodb-community
   # or
   sudo systemctl start mongod
   ```

3. **Configure environment variables:**
   - The `.env` file is already created in the `server` folder
   - Default connection: `mongodb://localhost:27017/straysignal`

### Option 2: MongoDB Atlas (Cloud Database)

1. **Create a free MongoDB Atlas account:**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account
   - Create a new cluster (free tier is sufficient)

2. **Get your connection string:**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

3. **Update the `.env` file:**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/straysignal?retryWrites=true&w=majority
   ```
   Replace `username`, `password`, and `cluster` with your actual credentials

4. **Whitelist your IP address:**
   - In MongoDB Atlas, go to "Network Access"
   - Add your current IP address or use 0.0.0.0/0 for testing (not recommended for production)

## Running the Server

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

   You should see:
   ```
   ✅ Connected to MongoDB
   🚀 Server is running on http://localhost:3000
   📍 API endpoints available at http://localhost:3000/api
   ```

## API Endpoints

### Health Check
- **GET** `/api/health` - Check if server is running

### Reports
- **GET** `/api/reports` - Get all animal reports
- **GET** `/api/reports/nearby?latitude=X&longitude=Y&radius=5` - Get nearby reports
- **GET** `/api/reports/:id` - Get a specific report by ID
- **POST** `/api/reports` - Create a new animal report
- **DELETE** `/api/reports/:id` - Delete a report

### POST `/api/reports` Request Body Example:
```json
{
  "latitude": 37.78825,
  "longitude": -122.4324,
  "time": "NOW",
  "animalType": "DOG",
  "direction": "heading north",
  "injured": false,
  "photos": ["file:///path/to/photo1.jpg"],
  "additionalInfo": "Friendly dog, looks lost",
  "timestamp": "2025-01-09T10:30:00.000Z"
}
```

## Testing the API

### Using curl:
```bash
# Health check
curl http://localhost:3000/api/health

# Get all reports
curl http://localhost:3000/api/reports

# Create a new report
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 37.78825,
    "longitude": -122.4324,
    "time": "NOW",
    "animalType": "DOG",
    "direction": "north",
    "injured": false,
    "photos": ["test.jpg"],
    "additionalInfo": "Test report"
  }'
```

## Connecting from Mobile App

### For Expo Go on the same network:
1. Find your computer's IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

2. Update the API URL in `app/(tabs)/signal.tsx`:
   ```typescript
   const API_URL = 'http://YOUR_COMPUTER_IP:3000/api/reports';
   // Example: const API_URL = 'http://192.168.1.100:3000/api/reports';
   ```

3. Make sure both your computer and phone are on the same WiFi network

### For production:
- Deploy your backend to a service like:
  - Heroku
  - Railway
  - Render
  - AWS EC2
  - DigitalOcean

## Database Schema

### AnimalReport Model:
```javascript
{
  latitude: Number (required),
  longitude: Number (required),
  time: String (required),
  animalType: String (required, enum: ['DOG', 'CAT', 'Other...']),
  direction: String,
  injured: Boolean (required),
  photos: [String],
  additionalInfo: String,
  timestamp: Date,
  reportedBy: String (default: 'anonymous'),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

## Troubleshooting

### Server won't start:
- Check if MongoDB is running
- Verify the MONGODB_URI in `.env`
- Check if port 3000 is already in use

### Can't connect from mobile app:
- Ensure both devices are on the same network
- Check firewall settings
- Verify the IP address is correct
- Try using `0.0.0.0` instead of `localhost` for development

### MongoDB connection fails:
- For local: ensure MongoDB service is running
- For Atlas: check username/password and IP whitelist

## Production Considerations

Before deploying to production:
1. Add authentication/authorization
2. Implement rate limiting
3. Add input validation and sanitization
4. Set up proper error logging
5. Use environment-specific configurations
6. Implement image storage (AWS S3, Cloudinary, etc.)
7. Add HTTPS support
8. Set up monitoring and alerts

## License

MIT
