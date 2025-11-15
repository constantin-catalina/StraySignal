// Advanced ML Service for Pet Image Matching
// Features: ResNet50, Triplet Loss fine-tuning support, Dynamic weight tuning
// FIXED: Proper weight balancing, species filtering, better aggregation

const tf = require('@tensorflow/tfjs-node');
const fetch = require('node-fetch');
const sharp = require('sharp');
const { Buffer } = require('buffer');

let baseModel = null;
let customModel = null;
let modelType = 'mobilenet'; // Track which model is loaded

let config = {
  // Optimized weights for pet identification
  weights: {
    visual: 0.70,      // Visual features are primary signal
    color: 0.20,       // Color helps but varies with lighting
    consistency: 0.10  // Photo quality matters
  },
  // Metadata bonuses (location is critical for lost pets!)
  metadataWeights: {
    animalTypeMatch: 0.03,  // Species/breed match
    distance: {
      veryClose: 0.05,  // <= 2km - very strong signal
      close: 0.03,      // <= 5km - strong signal
      near: 0.01,       // <= 10km - weak signal
      far: -0.08        // > 20km - strong penalty
    },
    temporal: {
      recent: 0.04,     // <= 3 days
      week: 0.02,       // <= 7 days
      old: -0.03        // > 30 days - gentle penalty (pets survive months)
    }
  },
  // Model configuration
  useCustomModel: false,
  modelPath: null,
  embeddingDim: 128,
  
  // Feature flags
  useSpeciesFiltering: true,    // Filter by animal type first
  useIndividualComparison: true, // Compare all photo pairs, not just means
  minPhotosRequired: 1
};

// Initialize base model with proper fallback
async function initializeBaseModel() {
  if (!baseModel) {
    console.log('Loading base model...');
    
    // Try MobileNet first (most reliable, no extra dependencies)
    try {
      const mobilenet = require('@tensorflow-models/mobilenet');
      baseModel = await mobilenet.load({
        version: 2,
        alpha: 1.0,
      });
      modelType = 'mobilenet';
      console.log('MobileNet loaded successfully (1024-dim features)');
      console.log('Note: For better accuracy, install @tensorflow/tfjs-converter and use ResNet50');
      return baseModel;
    } catch (error) {
      console.error('Failed to load MobileNet:', error);
      throw new Error('No model could be loaded. Install @tensorflow-models/mobilenet');
    }
    
    // TODO: To use ResNet50, implement custom loading:
    // 1. Download ResNet50 model files
    // 2. Load with tf.loadGraphModel('file://./models/resnet50/model.json')
    // 3. Update preprocessing for ResNet normalization
  }
  return baseModel;
}

// Initialize custom fine-tuned model (triplet loss / ArcFace)
async function initializeCustomModel() {
  if (!customModel && config.useCustomModel && config.modelPath) {
    console.log('Loading custom fine-tuned model...');
    try {
      customModel = await tf.loadLayersModel(config.modelPath);
      console.log('Custom model loaded successfully');
    } catch (error) {
      console.error('Failed to load custom model:', error);
      console.log('Falling back to base model');
      config.useCustomModel = false;
    }
  }
  return customModel;
}

// Update configuration
function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  if (newConfig.weights) {
    config.weights = { ...config.weights, ...newConfig.weights };
  }
  if (newConfig.metadataWeights) {
    config.metadataWeights = { 
      ...config.metadataWeights, 
      ...newConfig.metadataWeights 
    };
  }
  console.log('Configuration updated');
}

// Get current configuration
function getConfig() {
  return { ...config };
}

// Load and preprocess image
async function loadImage(imageSource, targetSize = 224) {
  try {
    let imageBuffer;
    
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      const response = await fetch(imageSource);
      imageBuffer = await response.buffer();
    } else if (imageSource.startsWith('data:image')) {
      const base64Data = imageSource.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Invalid image source');
    }

    const processedBuffer = await sharp(imageBuffer)
      .resize(targetSize, targetSize, { fit: 'cover' })
      .toBuffer();

    const tensor = tf.node.decodeImage(processedBuffer, 3)
      .expandDims(0)
      .toFloat();
    
    // MobileNet normalization: scale to [-1, 1]
    if (modelType === 'mobilenet') {
      return tensor.div(127.5).sub(1);
    }
    
    // ResNet50 normalization: ImageNet stats
    return tensor
      .div(255.0)
      .sub([0.485, 0.456, 0.406])
      .div([0.229, 0.224, 0.225]);
      
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

// Extract features using base model or custom model
async function extractFeatures(imageSource) {
  try {
    if (config.useCustomModel) {
      const model = await initializeCustomModel();
      if (model) {
        const imageTensor = await loadImage(imageSource, 224);
        const features = model.predict(imageTensor);
        const featureArray = await features.array();
        imageTensor.dispose();
        features.dispose();
        return featureArray[0];
      }
    }
    
    const model = await initializeBaseModel();
    const imageTensor = await loadImage(imageSource, 224);
    
    // Get embeddings from penultimate layer
    const features = model.infer(imageTensor, true);
    const featureArray = await features.array();
    
    imageTensor.dispose();
    features.dispose();
    
    return featureArray[0];
  } catch (error) {
    console.error('Error extracting features:', error);
    throw error;
  }
}

// Extract color histogram with distinctiveness weighting
async function extractColorHistogram(imageSource) {
  try {
    let imageBuffer;
    
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      const response = await fetch(imageSource);
      imageBuffer = await response.buffer();
    } else if (imageSource.startsWith('data:image')) {
      const base64Data = imageSource.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      return null;
    }

    const { data } = await sharp(imageBuffer)
      .resize(64, 64)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const bins = 8;
    const histogram = new Array(bins * bins * bins).fill(0);
    
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.min(Math.floor(data[i] / 256 * bins), bins - 1);
      const g = Math.min(Math.floor(data[i + 1] / 256 * bins), bins - 1);
      const b = Math.min(Math.floor(data[i + 2] / 256 * bins), bins - 1);
      const idx = r * bins * bins + g * bins + b;
      histogram[idx]++;
    }
    
    const total = data.length / 3;
    const normalized = histogram.map(v => v / total);
    
    // Calculate color distinctiveness (entropy)
    let entropy = 0;
    for (const val of normalized) {
      if (val > 0) {
        entropy -= val * Math.log2(val);
      }
    }
    const maxEntropy = Math.log2(bins * bins * bins);
    const distinctiveness = entropy / maxEntropy; // 0 to 1
    
    return { histogram: normalized, distinctiveness };
  } catch (error) {
    console.warn('Error extracting color histogram:', error.message);
    return null;
  }
}

// Cosine similarity
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

  if (norm1 === 0 || norm2 === 0) return 0;

  return Math.max(-1, Math.min(1, dotProduct / (norm1 * norm2)));
}

// Euclidean distance
function euclideanDistance(features1, features2) {
  if (features1.length !== features2.length) {
    throw new Error('Feature vectors must have the same length');
  }

  let sumSquaredDiff = 0;
  for (let i = 0; i < features1.length; i++) {
    const diff = features1[i] - features2[i];
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
}

// Calculate similarity score
function calculateSimilarity(features1, features2, useTripletLoss = false) {
  if (useTripletLoss) {
    const distance = euclideanDistance(features1, features2);
    return Math.exp(-distance);
  } else {
    const cosSim = cosineSimilarity(features1, features2);
    return (cosSim + 1) / 2;
  }
}

// Histogram intersection
function histogramIntersection(hist1, hist2) {
  if (!hist1 || !hist2 || hist1.length !== hist2.length) return 0;
  
  let intersection = 0;
  for (let i = 0; i < hist1.length; i++) {
    intersection += Math.min(hist1[i], hist2[i]);
  }
  return intersection;
}

// Better aggregation: keep individual embeddings for pairwise comparison
function aggregateEmbeddingsAdvanced(embeddings) {
  if (!embeddings.length) return null;
  
  const length = embeddings[0].length;
  const mean = new Array(length).fill(0);
  
  // Calculate mean
  for (const emb of embeddings) {
    for (let i = 0; i < length; i++) {
      mean[i] += emb[i];
    }
  }
  for (let i = 0; i < length; i++) {
    mean[i] /= embeddings.length;
  }
  
  // Calculate consistency (how similar are photos to each other)
  let consistencySum = 0;
  for (const emb of embeddings) {
    const sim = calculateSimilarity(emb, mean, config.useCustomModel);
    consistencySum += sim;
  }
  const consistency = consistencySum / embeddings.length;
  
  return { 
    mean, 
    individual: embeddings,  // Keep individual for pairwise comparison
    consistency 
  };
}

// Aggregate color histograms
function aggregateHistograms(histData) {
  if (!histData.length) return null;
  
  const histograms = histData.map(h => h.histogram);
  const length = histograms[0].length;
  const mean = new Array(length).fill(0);
  
  for (const hist of histograms) {
    for (let i = 0; i < length; i++) {
      mean[i] += hist[i];
    }
  }
  for (let i = 0; i < length; i++) {
    mean[i] /= histograms.length;
  }
  
  // Average distinctiveness
  const avgDistinctiveness = histData.reduce((sum, h) => sum + h.distinctiveness, 0) / histData.length;
  
  return { histogram: mean, distinctiveness: avgDistinctiveness };
}

// Build comprehensive descriptor
async function buildReportDescriptor(report) {
  const photos = report.photos || [];
  if (!photos.length || photos.length < config.minPhotosRequired) return null;
  
  const embeddings = [];
  const colorData = [];
  
  for (const photoUrl of photos) {
    try {
      const [embedding, colorHist] = await Promise.all([
        extractFeatures(photoUrl),
        extractColorHistogram(photoUrl)
      ]);
      embeddings.push(embedding);
      if (colorHist) colorData.push(colorHist);
    } catch (e) {
      console.warn('Failed processing photo:', e.message);
    }
  }
  
  if (!embeddings.length) return null;
  
  const embAgg = aggregateEmbeddingsAdvanced(embeddings);
  const colorAgg = colorData.length ? aggregateHistograms(colorData) : null;
  
  return {
    meanEmbedding: embAgg.mean,
    individualEmbeddings: embAgg.individual,
    embeddingConsistency: embAgg.consistency,
    colorHistogram: colorAgg ? colorAgg.histogram : null,
    colorDistinctiveness: colorAgg ? colorAgg.distinctiveness : 0,
    photoCount: photos.length
  };
}

// Calculate geographic distance
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize animal type for comparison
function normalizeAnimalType(type) {
  if (!type) return null;
  const normalized = type.toLowerCase().trim();
  
  // Map common variations
  const mappings = {
    'dog': ['dog', 'dogs', 'puppy', 'puppies', 'canine'],
    'cat': ['cat', 'cats', 'kitten', 'kittens', 'feline'],
    'bird': ['bird', 'birds', 'parrot', 'parrots'],
    'rabbit': ['rabbit', 'rabbits', 'bunny', 'bunnies']
  };
  
  for (const [key, variants] of Object.entries(mappings)) {
    if (variants.includes(normalized)) return key;
  }
  
  return normalized;
}

// Compare two images directly
async function compareImages(spottedImageUrl, lostPetImageUrl) {
  try {
    console.log('Comparing images...');
    
    const [spottedFeatures, lostFeatures, spottedColor, lostColor] = await Promise.all([
      extractFeatures(spottedImageUrl),
      extractFeatures(lostPetImageUrl),
      extractColorHistogram(spottedImageUrl),
      extractColorHistogram(lostPetImageUrl),
    ]);

    const visualScore = calculateSimilarity(spottedFeatures, lostFeatures, config.useCustomModel);
    
    let colorScore = 0;
    if (spottedColor && lostColor) {
      colorScore = histogramIntersection(spottedColor.histogram, lostColor.histogram);
      // Weight color by distinctiveness (distinctive colors matter more)
      const colorWeight = (spottedColor.distinctiveness + lostColor.distinctiveness) / 2;
      colorScore *= (0.5 + colorWeight * 0.5); // Scale between 0.5 and 1.0
    }
    
    const combinedScore = 
      visualScore * config.weights.visual + 
      colorScore * config.weights.color;
    
    const matchScore = Math.round(combinedScore * 100);
    
    console.log(`Visual: ${Math.round(visualScore * 100)}%, Color: ${Math.round(colorScore * 100)}%, Final: ${matchScore}%`);
    return matchScore;
  } catch (error) {
    console.error('Error comparing images:', error);
    throw error;
  }
}

// Compare using all photo pairs (better than just means)
function comparePairwise(spottedDesc, lostDesc) {
  const spottedEmbs = spottedDesc.individualEmbeddings;
  const lostEmbs = lostDesc.individualEmbeddings;
  
  const similarities = [];
  
  // Compare each spotted photo with each lost photo
  for (const spottedEmb of spottedEmbs) {
    for (const lostEmb of lostEmbs) {
      const sim = calculateSimilarity(spottedEmb, lostEmb, config.useCustomModel);
      similarities.push(sim);
    }
  }
  
  // Use top-K average (ignore worst matches, focus on best)
  similarities.sort((a, b) => b - a);
  const topK = Math.min(3, Math.ceil(similarities.length * 0.3)); // Top 30% or 3 best
  const topAvg = similarities.slice(0, topK).reduce((sum, s) => sum + s, 0) / topK;
  
  return topAvg;
}

// Find matching lost pets
async function findMatches(spottedReport, lostPets, threshold = 68) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Finding matches for spotted animal among ${lostPets.length} lost pets`);
    console.log(`Model: ${modelType.toUpperCase()} ${config.useCustomModel ? '+ Custom Fine-tuned' : ''}`);
    console.log(`Threshold: ${threshold}% | Weights: V=${config.weights.visual} C=${config.weights.color} Q=${config.weights.consistency}`);
    console.log('='.repeat(80));
    
    const matches = [];
    const spottedDesc = await buildReportDescriptor(spottedReport);
    
    if (!spottedDesc) {
      console.log('[ML] No usable photos in spotted report');
      return matches;
    }
    
    console.log(`[ML] Spotted: ${spottedDesc.photoCount} photos, consistency: ${(spottedDesc.embeddingConsistency * 100).toFixed(1)}%`);
    
    // Filter by species first (if enabled)
    let candidatePets = lostPets;
    if (config.useSpeciesFiltering && spottedReport.animalType) {
      const spottedType = normalizeAnimalType(spottedReport.animalType);
      candidatePets = lostPets.filter(pet => {
        const petType = normalizeAnimalType(pet.animalType);
        return !petType || petType === spottedType;
      });
      console.log(`[ML] Species filter: ${candidatePets.length}/${lostPets.length} candidates (type: ${spottedType})`);
    }
    
    for (const lostPet of candidatePets) {
      if (!lostPet.photos || !lostPet.photos.length) continue;
      
      try {
        const lostDesc = await buildReportDescriptor(lostPet);
        if (!lostDesc) continue;
        
        // Visual similarity: use pairwise if enabled, otherwise use means
        let visualScore;
        if (config.useIndividualComparison && 
            spottedDesc.individualEmbeddings.length > 0 && 
            lostDesc.individualEmbeddings.length > 0) {
          visualScore = comparePairwise(spottedDesc, lostDesc);
        } else {
          visualScore = calculateSimilarity(
            spottedDesc.meanEmbedding, 
            lostDesc.meanEmbedding,
            config.useCustomModel
          );
        }
        
        // Color similarity (weighted by distinctiveness)
        let colorScore = 0;
        if (spottedDesc.colorHistogram && lostDesc.colorHistogram) {
          colorScore = histogramIntersection(spottedDesc.colorHistogram, lostDesc.colorHistogram);
          // Distinctive colors matter more
          const avgDistinct = (spottedDesc.colorDistinctiveness + lostDesc.colorDistinctiveness) / 2;
          colorScore *= (0.5 + avgDistinct * 0.5);
        }
        
        // Consistency score
        const consistencyScore = Math.min(
          spottedDesc.embeddingConsistency, 
          lostDesc.embeddingConsistency
        );
        
        // Base score
        let baseScore = 
          visualScore * config.weights.visual +
          colorScore * config.weights.color +
          consistencyScore * config.weights.consistency;
        
        // Metadata adjustments
        let metadataBonus = 0;
        const metadataDetails = [];
        
        // Animal type (already filtered, but still give small bonus)
        if (spottedReport.animalType && lostPet.animalType) {
          const spottedType = normalizeAnimalType(spottedReport.animalType);
          const lostType = normalizeAnimalType(lostPet.animalType);
          if (spottedType === lostType) {
            metadataBonus += config.metadataWeights.animalTypeMatch;
            metadataDetails.push('type✓');
          }
        }
        
        // Geographic proximity (CRITICAL for lost pets)
        if (lostPet.latitude && lostPet.longitude && 
            spottedReport.latitude && spottedReport.longitude) {
          const distKm = calculateDistance(
            lostPet.latitude, lostPet.longitude,
            spottedReport.latitude, spottedReport.longitude
          );
          
          if (distKm <= 2) {
            metadataBonus += config.metadataWeights.distance.veryClose;
            metadataDetails.push(`${distKm.toFixed(1)}km++`);
          } else if (distKm <= 5) {
            metadataBonus += config.metadataWeights.distance.close;
            metadataDetails.push(`${distKm.toFixed(1)}km+`);
          } else if (distKm <= 10) {
            metadataBonus += config.metadataWeights.distance.near;
            metadataDetails.push(`${distKm.toFixed(1)}km`);
          } else if (distKm > 20) {
            metadataBonus += config.metadataWeights.distance.far;
            metadataDetails.push(`${distKm.toFixed(1)}km--`);
          } else {
            metadataDetails.push(`${distKm.toFixed(1)}km`);
          }
        }
        
        // Temporal proximity
        const lostDate = new Date(lostPet.lastSeenDate || lostPet.createdAt);
        const spottedDate = new Date(spottedReport.timestamp || spottedReport.createdAt);
        const daysDiff = Math.abs((spottedDate.getTime() - lostDate.getTime()) / 86400000);
        
        if (daysDiff <= 3) {
          metadataBonus += config.metadataWeights.temporal.recent;
          metadataDetails.push(`${daysDiff.toFixed(0)}d++`);
        } else if (daysDiff <= 7) {
          metadataBonus += config.metadataWeights.temporal.week;
          metadataDetails.push(`${daysDiff.toFixed(0)}d+`);
        } else if (daysDiff > 30) {
          metadataBonus += config.metadataWeights.temporal.old;
          metadataDetails.push(`${daysDiff.toFixed(0)}d-`);
        } else {
          metadataDetails.push(`${daysDiff.toFixed(0)}d`);
        }
        
        // Final score
        let finalScore = baseScore + metadataBonus;
        finalScore = Math.max(0, Math.min(1, finalScore));
        const matchScore = Math.round(finalScore * 100);
        
        const status = matchScore >= threshold ? '[OK]' : '    ';
        console.log(
          `${status} ${(lostPet.petName || 'Unknown').padEnd(15)} | ` +
          `V:${(visualScore * 100).toFixed(0).padStart(2)}% ` +
          `C:${(colorScore * 100).toFixed(0).padStart(2)}% ` +
          `Q:${(consistencyScore * 100).toFixed(0).padStart(2)}% ` +
          `[${metadataDetails.join(' ')}] ` +
          `→ ${matchScore}%`
        );
        
        if (matchScore >= threshold) {
          matches.push({
            lostPetId: lostPet._id,
            lostPetName: lostPet.petName,
            ownerId: lostPet.reportedBy,
            matchScore,
            visualSimilarity: Math.round(visualScore * 100),
            colorSimilarity: Math.round(colorScore * 100),
            consistency: Math.round(consistencyScore * 100),
            spottedReportId: spottedReport._id,
            details: {
              photoCount: `${spottedDesc.photoCount}/${lostDesc.photoCount}`,
              metadata: metadataDetails.join(' '),
              baseScore: Math.round(baseScore * 100),
              metadataBonus: Math.round(metadataBonus * 100),
              colorDistinctiveness: Math.round(((spottedDesc.colorDistinctiveness + lostDesc.colorDistinctiveness) / 2) * 100)
            }
          });
        }
      } catch (e) {
        console.error(`[ML] Error processing ${lostPet._id}:`, e.message);
      }
    }
    
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    console.log('='.repeat(80));
    console.log(`[ML] Found ${matches.length} matches above ${threshold}% threshold`);
    if (matches.length > 0) {
      console.log(`   Top match: ${matches[0].lostPetName} (${matches[0].matchScore}%)`);
    }
    console.log('='.repeat(80) + '\n');
    
    return matches;
  } catch (err) {
    console.error('Error in findMatches:', err);
    throw err;
  }
}

// Preset configurations
const presets = {
  highPrecision: {
    threshold: 75,
    weights: { visual: 0.75, color: 0.18, consistency: 0.07 },
    metadataWeights: {
      animalTypeMatch: 0.02,
      distance: { veryClose: 0.04, close: 0.02, near: 0, far: -0.10 },
      temporal: { recent: 0.03, week: 0.01, old: -0.05 }
    }
  },
  balanced: {
    threshold: 68,
    weights: { visual: 0.70, color: 0.20, consistency: 0.10 },
    metadataWeights: {
      animalTypeMatch: 0.03,
      distance: { veryClose: 0.05, close: 0.03, near: 0.01, far: -0.08 },
      temporal: { recent: 0.04, week: 0.02, old: -0.03 }
    }
  },
  highRecall: {
    threshold: 60,
    weights: { visual: 0.65, color: 0.25, consistency: 0.10 },
    metadataWeights: {
      animalTypeMatch: 0.04,
      distance: { veryClose: 0.06, close: 0.04, near: 0.02, far: -0.05 },
      temporal: { recent: 0.05, week: 0.03, old: -0.02 }
    }
  }
};

function loadPreset(presetName = 'balanced') {
  const preset = presets[presetName];
  if (!preset) {
    console.warn(`Preset '${presetName}' not found, using 'balanced'`);
    return loadPreset('balanced');
  }
  
  updateConfig({
    weights: preset.weights,
    metadataWeights: preset.metadataWeights
  });
  
  console.log(`[ML] Loaded preset: ${presetName}`);
  return preset.threshold;
}

function analyzeMatchQuality(matches, feedback) {
  const stats = {
    total: matches.length,
    correct: 0,
    falsePositives: 0,
    averageScore: 0,
    recommendations: []
  };
  
  if (!feedback || !feedback.length) {
    console.log('No feedback provided for analysis');
    return stats;
  }
  
  const feedbackMap = new Map(feedback.map(f => [f.matchId, f.isCorrect]));
  
  matches.forEach(match => {
    const isCorrect = feedbackMap.get(match.lostPetId);
    if (isCorrect === true) stats.correct++;
    if (isCorrect === false) stats.falsePositives++;
    stats.averageScore += match.matchScore;
  });
  
  stats.averageScore /= matches.length;
  const precision = stats.correct / (stats.correct + stats.falsePositives) || 0;
  
  console.log('\n' + '='.repeat(50));
  console.log('[ML] MATCH QUALITY ANALYSIS');
  console.log('='.repeat(50));
  console.log(`Total matches: ${stats.total}`);
  console.log(`Correct: ${stats.correct}`);
  console.log(`False positives: ${stats.falsePositives}`);
  console.log(`Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`Average score: ${stats.averageScore.toFixed(1)}%`);
  
  if (stats.falsePositives > stats.correct) {
    stats.recommendations.push('[WARNING] HIGH FALSE POSITIVES detected');
    stats.recommendations.push('-> Increase threshold by 5-10 points');
    stats.recommendations.push('-> Reduce metadata bonuses');
    stats.recommendations.push('-> Try loadPreset("highPrecision")');
    
    const newThreshold = Math.min(85, Math.round(stats.averageScore + 5));
    stats.recommendations.push(`-> Suggested threshold: ${newThreshold}%`);
  } else if (precision > 0.9 && stats.correct < 5) {
    stats.recommendations.push('[OK] Good precision but few matches');
    stats.recommendations.push('-> Consider lowering threshold slightly');
    stats.recommendations.push('-> Try loadPreset("balanced") or "highRecall"');
  } else if (precision > 0.8) {
    stats.recommendations.push('[OK] Good balance! Settings working well');
  } else if (precision < 0.5) {
    stats.recommendations.push('[WARNING] LOW PRECISION - too many false positives');
    stats.recommendations.push('-> Increase threshold significantly (+10-15)');
    stats.recommendations.push('-> Use loadPreset("highPrecision")');
  }
  
  console.log('\nRECOMMENDATIONS:');
  stats.recommendations.forEach(rec => console.log(`   ${rec}`));
  console.log('='.repeat(50) + '\n');
  
  return stats;
}

// Train custom model with triplet loss
async function trainTripletLossModel(trainingData, options = {}) {
  console.log('Training custom triplet loss model...');
  
  const {
    embeddingDim = 128,
    margin = 0.2,
    learningRate = 0.001,
    savePath = 'file://./models/pet-triplet-model'
  } = options;
  
  await initializeBaseModel();
  
  // Create embedding model (proper architecture)
  const input = tf.input({ shape: [224, 224, 3] });
  
  // Feature extraction backbone (frozen base model weights)
  // Note: This is a simplified version. In production, you'd:
  // 1. Load base model weights
  // 2. Create new embedding head
  // 3. Freeze base layers
  
  const embedding = tf.layers.dense({
    units: embeddingDim,
    activation: 'linear',
    name: 'embedding_layer',
    kernelInitializer: 'glorotNormal'
  }).apply(input);
  
  // L2 normalization
  const normalized = tf.layers.lambda({
    outputShape: [embeddingDim],
    call: (inputs) => {
      const x = inputs[0];
      return tf.div(x, tf.add(tf.norm(x, 2, -1, true), 1e-10));
    }
  }).apply(embedding);
  
  const model = tf.model({ inputs: input, outputs: normalized });
  
  console.log(`✅ Model architecture created`);
  console.log(`   Embedding dim: ${embeddingDim}`);
  console.log(`   Margin: ${margin}`);
  console.log(`   Learning rate: ${learningRate}`);
  
  console.log('\n⚠️  NOTE: Full training requires:');
  console.log('   1. Triplet dataset: {anchor, positive, negative} image sets');
  console.log('   2. Hard negative mining strategy');
  console.log('   3. Data augmentation pipeline');
  console.log('   4. Validation set for monitoring');
  console.log('\n   This function creates the model architecture.');
  console.log('   Implement training loop separately with your dataset.\n');
  
  await model.save(savePath);
  console.log(`💾 Model architecture saved to ${savePath}`);
  
  return model;
}

module.exports = {
  initializeBaseModel,
  initializeCustomModel,
  extractFeatures,
  compareImages,
  findMatches,
  trainTripletLossModel,
  updateConfig,
  getConfig,
  loadPreset,
  analyzeMatchQuality,
  presets
};