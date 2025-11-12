import TopBarSecondary from '@/components/TopBarSecondary';
import { API_ENDPOINTS } from '@/constants/api';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface LostPetCase {
  _id: string;
  reportedBy?: string;
  reportType?: 'lost-from-home' | 'spotted-on-streets';
  petName: string;
  animalType: string;
  breed?: string;
  lastSeenLocation: string;
  lastSeenDate: string;
  hasReward?: boolean;
  hasDistinctiveMarks?: boolean;
  distinctiveMarks?: string;
  additionalInfo?: string;
  photos: string[];
}

export default function PosterGenerator() {
  const router = useRouter();
  const { user } = useUser();
  const [cases, setCases] = useState<LostPetCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LostPetCase>>({});
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [userPhone, setUserPhone] = useState<string>('');
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    const loadPhoneSettings = async () => {
      if (!user?.id) return;
      try {
        const key = `user_profile_data:${user.id}`;
        const stored = await AsyncStorage.getItem(key);
        console.log('Stored profile data:', stored);
        if (stored) {
          const data = JSON.parse(stored);
          console.log('Show phone number setting:', data.showPhoneNumber);
          setShowPhone(data.showPhoneNumber || false);
          // Get phone from stored profile data
          if (data.phone) {
            console.log('Using phone from stored profile:', data.phone);
            setUserPhone(data.phone);
          }
        }
        // Also check Clerk phone as fallback
        const clerkPhone = user.phoneNumbers?.[0]?.phoneNumber;
        if (clerkPhone) {
          console.log('Using phone from Clerk:', clerkPhone);
          setUserPhone(clerkPhone);
        }
      } catch (e) {
        console.error('Failed to load phone settings', e);
      }
    };
    loadPhoneSettings();
  }, [user?.id, user?.phoneNumbers]);

  const loadMyLostCases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_ENDPOINTS.REPORTS);
      const json = await res.json();
      if (json.success) {
        const mine = (json.data as LostPetCase[]).filter(r => r.reportType === 'lost-from-home' && r.reportedBy === user?.id);
        setCases(mine);
        if (mine.length && !selectedId) {
          setSelectedId(mine[0]._id);
        }
      }
    } catch (e) {
      console.error('Failed to load cases', e);
      Alert.alert('Error', 'Could not load your lost cases');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedId]);

  useEffect(() => {
    loadMyLostCases();
  }, [loadMyLostCases]);

  useEffect(() => {
    const current = cases.find(c => c._id === selectedId);
    if (current) {
      setForm({
        _id: current._id,
        petName: current.petName,
        animalType: current.animalType,
        breed: current.breed || '',
        lastSeenLocation: current.lastSeenLocation,
        lastSeenDate: current.lastSeenDate,
        hasReward: current.hasReward || false,
        hasDistinctiveMarks: current.hasDistinctiveMarks || false,
        distinctiveMarks: current.distinctiveMarks || '',
        additionalInfo: current.additionalInfo || '',
        photos: current.photos,
      });
    }
  }, [selectedId, cases]);

  const updateField = (key: keyof LostPetCase, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const previewHtml = useMemo(() => {
    const phoneToPass = showPhone ? userPhone : '';
    console.log('Generating poster with:', { showPhone, userPhone, phoneToPass });
    return generatePosterHTML(form, user?.emailAddresses?.[0]?.emailAddress, { preview: true, phone: phoneToPass });
  }, [form, user, showPhone, userPhone]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'} translucent backgroundColor="#1E1F24" />
      <ImageBackground source={require('@/assets/backgrounds/Auth.png')} style={styles.bg} resizeMode="cover">
        <TopBarSecondary onBack={() => router.back()} title="Poster Generator" />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>CREATE A POSTER{"\n"}for your lost pet</Text>

          {/* Tabs + Editable Details as a unified card */}
          {loading ? (
            <Text style={styles.loading}>Loading your lost cases…</Text>
          ) : cases.length === 0 ? (
            <Text style={styles.empty}>You have no lost pet reports yet.</Text>
          ) : (
            <>
              {/* Pet selector outside of the edit container */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabBar}
                contentContainerStyle={styles.tabBarContent}
              >
                {cases.map(c => {
                  const active = selectedId === c._id;
                  return (
                    <TouchableOpacity
                      key={c._id}
                      style={[styles.tab, active ? styles.tabActive : styles.tabInactive]}
                      onPress={() => setSelectedId(c._id)}
                    >
                      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                        {c.petName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Editable Details container, now separate */}
              {selectedId && (
                <View style={styles.form}>
                  <Text style={styles.label}>Pet name</Text>
                  <TextInput style={styles.input} value={form.petName || ''} onChangeText={t => updateField('petName', t)} />

                  <Text style={styles.label}>Animal type</Text>
                  <TextInput style={styles.input} value={form.animalType || ''} onChangeText={t => updateField('animalType', t)} />

                  <Text style={styles.label}>Breed</Text>
                  <TextInput style={styles.input} value={form.breed || ''} onChangeText={t => updateField('breed', t)} />

                  <Text style={styles.label}>Last seen location</Text>
                  <TextInput style={styles.input} value={form.lastSeenLocation || ''} onChangeText={t => updateField('lastSeenLocation', t)} />

                  <Text style={styles.label}>Last seen date</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.dateText}>{form.lastSeenDate ? new Date(form.lastSeenDate).toLocaleDateString() : 'Pick date'}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={form.lastSeenDate ? new Date(form.lastSeenDate) : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(e, date) => {
                        setShowDatePicker(false);
                        if (date) updateField('lastSeenDate', date.toISOString());
                      }}
                      maximumDate={new Date()}
                    />
                  )}

                  <Text style={styles.label}>Distinctive marks</Text>
                  <TextInput style={styles.input} value={form.distinctiveMarks || ''} onChangeText={t => updateField('distinctiveMarks', t)} />

                  <Text style={styles.label}>Additional info</Text>
                  <TextInput style={[styles.input, styles.inputMultiline]} multiline value={form.additionalInfo || ''} onChangeText={t => updateField('additionalInfo', t)} />

                  <TouchableOpacity 
                    style={[styles.saveButton, styles.previewButton]} 
                    onPress={() => setPreviewExpanded(!previewExpanded)}
                  >
                    <Text style={styles.saveButtonText}>
                      {previewExpanded ? 'Hide poster preview' : 'Show poster preview'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveButton, styles.pdfButton]}
                    onPress={async () => {
                      if (!form.petName || !form.lastSeenLocation) {
                        Alert.alert('Missing data', 'Pet name and last seen location are required for the poster.');
                        return;
                      }
                      try {
                        const html = generatePosterHTML(form, user?.emailAddresses?.[0]?.emailAddress, { phone: showPhone ? userPhone : '' });
                        const { uri: tempUri } = await Print.printToFileAsync({ html });
                        const fileName = `Lost_${(form.animalType || 'Pet').replace(/\s+/g,'_')}_${(form.petName || 'Poster').replace(/\s+/g,'_')}.pdf`;

                        // Platform-specific save/share logic
                        if (Platform.OS === 'android') {
                          try {
                            // Attempt Storage Access Framework for user-directed save (Android 10+)
                            const SAF = (FileSystem as any).StorageAccessFramework;
                            const permissions = await SAF.requestDirectoryPermissionsAsync();
                            if (permissions.granted) {
                              const base64 = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' as any });
                              const destUri = await SAF.createFileAsync(permissions.directoryUri, fileName, 'application/pdf');
                              await FileSystem.writeAsStringAsync(destUri, base64, { encoding: 'base64' as any });
                              Alert.alert('PDF saved', 'File stored successfully.');
                              return;
                            }
                          } catch (safErr) {
                            console.warn('SAF save failed, falling back to Sharing:', safErr);
                          }
                          // Fallback: share sheet
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(tempUri, { mimeType: 'application/pdf', dialogTitle: 'Share poster PDF', UTI: 'com.adobe.pdf' });
                          } else {
                            Alert.alert('PDF ready', `Temporary file: ${tempUri}`);
                          }
                        } else if (Platform.OS === 'ios') {
                          // iOS: present share sheet (user can save to Files / AirDrop)
                          if (await Sharing.isAvailableAsync()) {
                            await Sharing.shareAsync(tempUri, { mimeType: 'application/pdf', dialogTitle: 'Share poster PDF', UTI: 'com.adobe.pdf' });
                          } else {
                            Alert.alert('PDF ready', `Generated at: ${tempUri}`);
                          }
                        } else {
                          // Web or other: just open or alert path
                          Alert.alert('PDF generated', `Saved to: ${tempUri}`);
                        }
                      } catch (e:any) {
                        Alert.alert('Error', e.message || 'Failed to generate PDF');
                      }
                    }}
                  >
                    <Text style={styles.saveButtonText}>Generate PDF</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Live A4 Poster Preview (identical to PDF HTML) */}
          {previewExpanded && (
            <View style={styles.webPreviewContainer}>
              <WebView
                originWhitelist={["*"]}
                source={{ html: previewHtml }}
                style={styles.webPreview}
                automaticallyAdjustContentInsets={false}
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 32, fontWeight: '600', color: '#23395B', marginBottom: 40, marginTop: 35, textAlign: 'center', lineHeight: 40 },
  loading: { color: '#fff', textAlign: 'center', marginVertical: 20 },
  empty: { color: '#fff', textAlign: 'center', marginVertical: 20 },
  // Deprecated chip styles kept for reference (no longer used)
  casePicker: { marginBottom: 12 },
  caseChip: { backgroundColor: '#D9D9D9', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, marginRight: 8 },
  caseChipActive: { backgroundColor: '#23395B' },
  caseChipText: { color: '#FFFFFF', fontWeight: '600' },
  // New unified editor card with folder-like tabs
  editorCard: { backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  tabBar: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingTop: 8, paddingBottom: 0 },
  tabBarContent: { paddingHorizontal: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#E5E7EB', marginBottom: -1 },
  tabInactive: {},
  tabActive: { backgroundColor: '#23395B', borderColor: '#23395B' },
  tabText: { color: '#1E1F24', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  formInsideCard: { padding: 16, paddingTop: 12 },
  form: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 16, marginBottom: 16 },
  label: { color: '#1E1F24', marginTop: 8, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 10, color: '#111827' },
  inputMultiline: { height: 80 },
  saveButton: { marginTop: 14, backgroundColor: '#23395B', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  previewButton: { backgroundColor: '#23395B' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 16, marginTop: 12 },
  previewTitle: { fontSize: 18, fontWeight: '700', color: '#23395B' },
  previewToggle: { fontSize: 16, color: '#23395B', fontWeight: '700' },
  webPreviewContainer: { backgroundColor: '#2e1c2b', borderRadius: 12, overflow: 'hidden', aspectRatio: 210/297, width: '100%', marginTop: 8 },
  webPreview: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  posterHeader: { alignItems: 'center', marginTop: 8 },
  posterTitle: { fontSize: 40, fontWeight: '900', color: '#fff' },
  posterSubtitle: { fontSize: 16, color: '#ddd', marginTop: 6, fontWeight: '700' },
  posterImageWrap: { marginTop: 12, alignItems: 'center' },
  posterImageContainer: { width: '90%', aspectRatio: 16/9, borderRadius: 8, overflow: 'hidden', backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  posterImageFill: { width: '100%', height: '100%' },
  posterImagePlaceholder: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  posterBody: { paddingHorizontal: 12, paddingTop: 12 },
  posterBodyText: { color: '#fff', textAlign: 'center' },
  posterBodyTextSmall: { color: '#fff', textAlign: 'center', marginTop: 6, fontSize: 12, opacity: 0.9 },
  posterTearoffs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', height: 90, marginTop: 'auto', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', paddingTop: 8 },
  tearoff: { width: `${100/10}%`, height: 80, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
  tearoffInner: { transform: [{ rotate: '-90deg' }], alignItems: 'center', justifyContent: 'center' },
  tearoffText: { color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  tearoffTextSmall: { color: '#fff', fontSize: 10, textAlign: 'center' },
    pdfButton: { backgroundColor: '#668586', marginTop: 10 },
    dateText: { color: '#111827' }
});

  function escapeHtml(str: string) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generatePosterHTML(form: Partial<LostPetCase>, contactEmail?: string, options?: { preview?: boolean; phone?: string }) {
    const petName = escapeHtml(form.petName || 'Lost Pet');
    const animalType = escapeHtml(form.animalType || 'Pet');
    const location = escapeHtml(form.lastSeenLocation || 'Unknown location');
    const date = form.lastSeenDate ? new Date(form.lastSeenDate).toLocaleDateString() : 'Unknown date';
    const marks = form.hasDistinctiveMarks && form.distinctiveMarks ? `Distinctive marks: ${escapeHtml(form.distinctiveMarks)}` : '';
    const info = escapeHtml(form.additionalInfo || '');
    const email = escapeHtml(contactEmail || 'email@domain.com');
    const phone = options?.phone ? escapeHtml(options.phone) : '';
    console.log('generatePosterHTML - phone value:', phone, 'options.phone:', options?.phone);
    const photo = form.photos && form.photos.length ? form.photos[0] : '';
    const isPreview = !!options?.preview;
    return `<!doctype html><html><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      @page { size: A4; margin: 0; }
      html, body { ${isPreview ? 'width:100%;height:100%;' : 'width:210mm;height:297mm;'} margin:0; padding:0; }
      body { font-family: Arial, Helvetica, sans-serif; background:#2e1c2b; color:#fff; overflow:hidden; }
      .page { width:210mm; height:297mm; padding:12mm 16mm 40mm 16mm; box-sizing:border-box; position:relative; ${isPreview ? 'transform-origin:top left;' : ''} }
      h1 { text-align:center; font-size:60px; margin:0 0 4px; letter-spacing:1.5px; font-weight: 900; }
      h2 { text-align:center; font-weight:700; margin:0 0 10px; font-size:18px; color:#eee; }
      .photo { width: 150mm; height:115mm; border-radius:8px; overflow:hidden; background:#eee; display:flex; align-items:center; justify-content:center; margin:0 auto 12px auto; }
      .photo img { width:100%; height:100%; object-fit:cover; object-position:center; }
      .pet-name { text-align:center; font-size:28px; font-weight:800; margin:0 0 14px 0; color:#fff; letter-spacing:0.5px; }
      .section { font-size:16px; line-height:1.6; margin:0 0 8px; text-align:left; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:6px; }
      .section .label { font-weight:800; color:#fff; font-size:17px; }
      .contact { font-size:20px; margin:10px 0 0 0; font-weight:700; text-align:center; padding:10px; background:rgba(255,215,0,0.15); border-radius:8px; border:2px solid rgba(255,215,0,0.3); }
      .thankyou { font-size:25px; margin:10px 0 0 0; font-weight:600; text-align:center; font-style:italic; color:#fff; }
      .footer { position:absolute; bottom:0; left:0; right:0; height: 36mm; display:flex; gap: 0; }
      .tear { flex:1; border-top:1px solid rgba(255,255,255,0.7); border-right:1px dashed rgba(255,255,255,0.6); position:relative; overflow:hidden; }
      .tear:first-child { margin-left: 0; }
      .tear:last-child { border-right:none; margin-right: 0; }
      .tear-inner { position:absolute; top:50%; left:50%; transform: translate(-50%, -50%) rotate(-90deg); transform-origin:center; text-align:center; width:34mm; white-space:nowrap; overflow:hidden; }
      .tear-title { font-size:11px; font-weight:800; margin:0 0 2px 0; }
      .tear-contact { font-size:8px; margin:0; line-height:1.3; word-break:break-all; white-space:normal; }
  </style>
  ${isPreview ? `<script>(function(){function mmToPx(mm){return mm*(96/25.4);}function fit(){var p=document.querySelector('.page');var vw=document.documentElement.clientWidth||window.innerWidth;var s=vw/mmToPx(210);p.style.transform='scale('+s+')';document.body.style.height=(mmToPx(297)*s)+'px';}window.addEventListener('resize',fit);window.addEventListener('orientationchange',fit);window.onload=fit;})();</script>`:''}
  </head><body><div class="page">
    <h1>LOST ${animalType.toUpperCase()}</h1>
    <h2>PLEASE HELP ME FIND MY ${animalType.toUpperCase()}</h2>
    <div class="photo">${photo ? `<img src="${photo}" />` : ''}</div>
    <div class="pet-name">Missing: ${petName}</div>
    <div class="section"><span class="label">Last seen:</span> ${location} on ${date}</div>
    ${marks ? `<div class="section"><span class="label">Distinctive marks:</span> ${marks.replace('Distinctive marks: ', '')}</div>` : ''}
    ${info ? `<div class="section"><span class="label">Details:</span> ${info}</div>` : ''}
    <div class="contact">If seen, please contact: <br/> <br/> ${email}${phone ? ` or ${phone}` : ''}</div>
    <div class="thankyou"> </br>Thank you for helping bring ${petName} home.</div>
    <div class="footer">
      ${Array.from({ length: 10 }).map(() => `
        <div class="tear">
          <div class="tear-inner">
            <div class="tear-title">FOUND ${animalType.toUpperCase()}</div>
            <div class="tear-contact">${email}${phone ? `<br>${phone}` : ''}</div>
          </div>
        </div>`).join('')}
    </div>
    </div></body></html>`;
  }
