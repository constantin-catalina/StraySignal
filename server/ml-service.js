// ML Service for Pet Image Matching
// This service uses TensorFlow.js with MobileNet for feature extraction
// and cosine similarity for comparing pet images

const tf = require('@tensorflow/tfjs-node');
const mobilenet = require('@tensorflow-models/mobilenet');
const fetch = require('node-fetch');
const sharp = require('sharp');

let model = null;

// Initialize the MobileNet model
async function initializeModel() {
  if (!model) {
    console.log('Loading MobileNet model...');
    model = await mobilenet.load({
      version: 2,
      alpha: 1.0,
    });
    console.log('MobileNet model loaded successfully');
  }
  return model;
}

// Load and preprocess image from URL or base64
async function loadImage(imageSource) {
  try {
    let imageBuffer;
    
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      // Load from URL
      const response = await fetch(imageSource);
      imageBuffer = await response.buffer();
    } else if (imageSource.startsWith('data:image')) {
      // Load from base64
      const base64Data = imageSource.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Invalid image source');
    }

    // Resize and normalize image using sharp
    const processedBuffer = await sharp(imageBuffer)
      .resize(224, 224, { fit: 'cover' })
      .toBuffer();

    // Convert to tensor
    const tensor = tf.node.decodeImage(processedBuffer, 3)
      .expandDims(0)
      .toFloat()
      .div(127.5)
      .sub(1);

    return tensor;
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

// Extract features from an image using MobileNet
async function extractFeatures(imageSource) {
  try {
    const model = await initializeModel();
    const imageTensor = await loadImage(imageSource);
    
    // Get the feature vector (embeddings) from the second-to-last layer
    const features = model.infer(imageTensor, true);
    
    // Normalize the features
    const normalized = tf.tidy(() => {
      const norm = tf.sqrt(tf.sum(tf.square(features)));
      return tf.div(features, norm);
    });
    
    // Convert to array
    const featureArray = await normalized.array();
    
    // Cleanup
    imageTensor.dispose();
    features.dispose();
    normalized.dispose();
    
    return featureArray[0];
  } catch (error) {
    console.error('Error extracting features:', error);
    throw error;
  }
}

// Calculate cosine similarity between two feature vectors
function cosineSimilarity(features1, features2) {
  if (features1.length !== features2.length) {
    throw new Error('Feature vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < features1.length; i++) {
    dotProduct += features1[i] * features2[i];
    norm1 += features1[i] * features1[i];
    norm2 += features2[i] * features2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

// Compare a spotted animal image with a lost pet image
async function compareImages(spottedImageUrl, lostPetImageUrl) {
  try {
    console.log('Comparing images...');
    
    // Extract features from both images
    const [spottedFeatures, lostFeatures] = await Promise.all([
      extractFeatures(spottedImageUrl),
      extractFeatures(lostPetImageUrl),
    ]);

    // Calculate similarity
    const similarity = cosineSimilarity(spottedFeatures, lostFeatures);
    
    // Convert to percentage (0-100)
    const matchScore = Math.round(similarity * 100);
    
    console.log(`Match score: ${matchScore}%`);
    return matchScore;
  } catch (error) {
    console.error('Error comparing images:', error);
    throw error;
  }
}

// Compare a spotted animal with multiple lost pets and find best matches
async function findMatches(spottedReport, lostPets, threshold = 75) {
  try {
    console.log(`Finding matches for spotted animal against ${lostPets.length} lost pets...`);
    
    const matches = [];
    
    // Extract features from the spotted animal image once
    if (!spottedReport.photos || spottedReport.photos.length === 0) {
      console.log('No photos in spotted report');
      return matches;
    }
    
    const spottedImageUrl = spottedReport.photos[0];
    const spottedFeatures = await extractFeatures(spottedImageUrl);
    
    // Compare with each lost pet
    for (const lostPet of lostPets) {
      if (!lostPet.photos || lostPet.photos.length === 0) {
        continue;
      }
      
      try {
        // Compare with the first photo of the lost pet
        const lostImageUrl = lostPet.photos[0];
        const lostFeatures = await extractFeatures(lostImageUrl);
        
        const similarity = cosineSimilarity(spottedFeatures, lostFeatures);
        const matchScore = Math.round(similarity * 100);
        
        // Additional scoring based on metadata
        let adjustedScore = matchScore;
        
        // Bonus for matching animal type
        if (spottedReport.animalType?.toLowerCase() === lostPet.animalType?.toLowerCase()) {
          adjustedScore = Math.min(100, adjustedScore + 5);
        }
        
        // Bonus for proximity to last seen location
        if (lostPet.latitude && lostPet.longitude && 
            spottedReport.latitude && spottedReport.longitude) {
          const distance = calculateDistance(
            lostPet.latitude,
            lostPet.longitude,
            spottedReport.latitude,
            spottedReport.longitude
          );
          
          if (distance <= 1) adjustedScore = Math.min(100, adjustedScore + 5);
          else if (distance <= 3) adjustedScore = Math.min(100, adjustedScore + 3);
        }
        
        // Bonus for time proximity
        const lostDate = new Date(lostPet.lastSeenDate || lostPet.createdAt);
        const spottedDate = new Date(spottedReport.timestamp || spottedReport.createdAt);
        const daysDiff = Math.abs((spottedDate.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) adjustedScore = Math.min(100, adjustedScore + 3);
        else if (daysDiff <= 3) adjustedScore = Math.min(100, adjustedScore + 2);
        
        // Only include matches above threshold
        if (adjustedScore >= threshold) {
          matches.push({
            lostPetId: lostPet._id,
            lostPetName: lostPet.petName,
            ownerId: lostPet.reportedBy,
            matchScore: adjustedScore,
            visualSimilarity: matchScore,
            spottedReportId: spottedReport._id,
          });
        }
      } catch (error) {
        console.error(`Error comparing with lost pet ${lostPet._id}:`, error);
        // Continue with other pets
      }
    }
    
    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    console.log(`Found ${matches.length} matches above ${threshold}% threshold`);
    return matches;
  } catch (error) {
    console.error('Error finding matches:', error);
    throw error;
  }
}

// Helper: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  initializeModel,
  extractFeatures,
  compareImages,
  findMatches,
};
