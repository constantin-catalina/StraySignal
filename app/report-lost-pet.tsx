import TopBarSecondary from '@/components/TopBarSecondary';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, ImageBackground, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReportLostPet() {
  const router = useRouter();
  
  // Form state
  const [petName, setPetName] = useState('');
  const [animalType, setAnimalType] = useState('');
  const [breed, setBreed] = useState('');
  const [lastSeenLocation, setLastSeenLocation] = useState('');
  const [lastSeenDate, setLastSeenDate] = useState('');
  const [hasReward, setHasReward] = useState<boolean | null>(null);
  const [hasDistinctiveMarks, setHasDistinctiveMarks] = useState<boolean | null>(null);
  const [distinctiveMarks, setDistinctiveMarks] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to select photos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos([...photos, ...newPhotos].slice(0, 5)); // Max 5 photos
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (!petName.trim()) {
      Alert.alert('Missing Information', 'Please enter your pet\'s name.');
      return;
    }
    if (!animalType.trim()) {
      Alert.alert('Missing Information', 'Please enter the type of animal.');
      return;
    }
    if (!lastSeenLocation.trim()) {
      Alert.alert('Missing Information', 'Please enter where your pet was last seen.');
      return;
    }
    if (!lastSeenDate.trim()) {
      Alert.alert('Missing Information', 'Please enter when your pet was last seen.');
      return;
    }
    if (photos.length < 2) {
      Alert.alert('Missing Photos', 'Please upload at least two photos of your pet.');
      return;
    }
    if (hasDistinctiveMarks === null) {
      Alert.alert('Missing Information', 'Please indicate if your pet has distinctive marks.');
      return;
    }
    if (hasDistinctiveMarks && !distinctiveMarks.trim()) {
      Alert.alert('Missing Information', 'Please describe the distinctive marks.');
      return;
    }

    try {
      // TODO: Submit to backend
      console.log('Submitting lost pet report:', {
        petName,
        animalType,
        breed,
        lastSeenLocation,
        lastSeenDate,
        hasReward,
        hasDistinctiveMarks,
        distinctiveMarks,
        additionalInfo,
        photos,
      });

      Alert.alert('Success', 'Your lost pet report has been submitted!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
        translucent
        backgroundColor="#1E1F24"
      />

      <ImageBackground
        source={require('@/assets/backgrounds/Auth.png')}
        style={styles.bg}          
        resizeMode="cover"
      >
        <TopBarSecondary onBack={() => router.back()} title="Report a Lost Pet" />
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <Text style={styles.heading}>REPORT{'\n'}your lost pet</Text>

            {/* Pet Name */}
            <Text style={styles.questionText}>What&apos;s your pet&apos;s name?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={petName}
              onChangeText={setPetName}
            />

            {/* Animal Type */}
            <Text style={styles.questionText}>What type of animal is it?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={animalType}
              onChangeText={setAnimalType}
            />

            {/* Breed */}
            <Text style={styles.questionText}>What breed is your pet?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={breed}
              onChangeText={setBreed}
            />

            {/* Last Seen Location */}
            <Text style={styles.questionText}>Where was your pet last seen?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={lastSeenLocation}
              onChangeText={setLastSeenLocation}
            />

            {/* Last Seen Date */}
            <Text style={styles.questionText}>When was your pet last seen?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={lastSeenDate}
              onChangeText={setLastSeenDate}
            />

            {/* Reward */}
            <Text style={styles.questionText}>Are you offering a reward for your pet&apos;s return?</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionButton, hasReward === true && styles.optionButtonSelected]}
                onPress={() => setHasReward(true)}
              >
                <Text style={[styles.optionButtonText, hasReward === true && styles.optionButtonTextSelected]}>
                  YES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, hasReward === false && styles.optionButtonSelected]}
                onPress={() => setHasReward(false)}
              >
                <Text style={[styles.optionButtonText, hasReward === false && styles.optionButtonTextSelected]}>
                  NO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Distinctive Marks */}
            <Text style={styles.questionText}>Does your pet have any distinctive marks?</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.optionButton, hasDistinctiveMarks === true && styles.optionButtonSelected]}
                onPress={() => setHasDistinctiveMarks(true)}
              >
                <Text style={[styles.optionButtonText, hasDistinctiveMarks === true && styles.optionButtonTextSelected]}>
                  YES
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, hasDistinctiveMarks === false && styles.optionButtonSelected]}
                onPress={() => setHasDistinctiveMarks(false)}
              >
                <Text style={[styles.optionButtonText, hasDistinctiveMarks === false && styles.optionButtonTextSelected]}>
                  NO
                </Text>
              </TouchableOpacity>
            </View>

            {/* Distinctive Marks Description */}
            {hasDistinctiveMarks && (
              <>
                <Text style={styles.questionText}>If yes, what?</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter text..."
                  placeholderTextColor="#999"
                  value={distinctiveMarks}
                  onChangeText={setDistinctiveMarks}
                />
              </>
            )}

            {/* Additional Info */}
            <Text style={styles.questionText}>
              Can you describe how your pet got lost / any other helpful info?
            </Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              multiline
              numberOfLines={4}
            />

            {/* Photo Upload */}
            <Text style={styles.questionText}>
              Upload at least two photos of the animal from different angles:
            </Text>
            <TouchableOpacity style={styles.photoUploadBox} onPress={pickImage}>
              <View style={styles.photoUploadContent}>
                {photos.length === 0 ? (
                  <Ionicons name="add-circle-outline" size={60} color="#999" />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewScroll}>
                    {photos.map((uri, index) => (
                      <View key={index} style={styles.photoPreviewContainer}>
                        <Image source={{ uri }} style={styles.photoPreview} />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => removePhoto(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {photos.length < 5 && (
                      <TouchableOpacity style={styles.addMoreButton} onPress={pickImage}>
                        <Ionicons name="add-circle-outline" size={40} color="#999" />
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}
              </View>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bg: { 
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 24,
  },
  heading: {
    fontSize: 32,
    fontWeight: '600',
    color: '#23395B',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 40,
  },
  questionText: {
    fontSize: 16,
  color: '#D9D9D9',
    marginTop: 16,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#333',
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#23395B',
  },
  optionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#23395B',
  },
  optionButtonTextSelected: {
    color: '#FFFFFF',
  },
  photoUploadBox: {
    backgroundColor: '#D9D9D9',
    borderRadius: 12,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  photoUploadContent: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
  },
  photoPreviewScroll: {
    width: '100%',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addMoreButton: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#999',
    borderStyle: 'dashed',
  },
  submitButton: {
    backgroundColor: '#23395B',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#D9D9D9',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});

