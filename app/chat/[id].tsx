import { ChatMessage } from '@/app/lib/chat';
import { getSocket } from '@/app/lib/socket';
import TopBarSecondary from '@/components/TopBarSecondary';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HistoryPayload { conversationId: string; messages: ChatMessage[] }

export default function ConversationScreen() {
  const router = useRouter();
  const { id, peerName, peerImage } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const { user } = useUser();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingText, setPendingText] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Append & scroll helper
  const appendMessage = useCallback((m: ChatMessage) => {
    setMessages(prev => {
      // Prevent duplicates - check if message already exists
      if (prev.some(existing => existing._id === m._id)) {
        return prev;
      }
      // Replace optimistic message with real one
      const optimisticIndex = prev.findIndex(msg => msg._id.startsWith('optim-') && msg.text === m.text && msg.senderId === m.senderId);
      if (optimisticIndex !== -1) {
        const updated = [...prev];
        updated[optimisticIndex] = m;
        return updated;
      }
      return [...prev, m];
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 10);
  }, []);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const socket = getSocket(userId);
    const onHistory = (payload: HistoryPayload) => {
      if (payload.conversationId !== conversationId) return;
      setMessages(payload.messages);
      setLoadingHistory(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 20);
      // Mark all unread messages as read
      payload.messages.forEach(m => {
        if (m.senderId !== userId && !(m.readBy || []).includes(userId)) {
          socket.emit('chat:read', { conversationId, messageId: m._id });
        }
      });
    };
    const onMsg = (m: ChatMessage) => {
      if (m.conversationId !== conversationId) return;
      appendMessage(m);
      // mark read if incoming
      if (m.senderId !== userId) {
        socket.emit('chat:read', { conversationId, messageId: m._id });
      }
    };
    const onTyping = ({ conversationId: cid, userId: uid, isTyping }: any) => {
      if (cid === conversationId && uid !== userId) setPeerTyping(!!isTyping);
    };
    const onRead = ({ conversationId: cid, messageId, userId: uid }: any) => {
      if (cid !== conversationId) return;
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, readBy: Array.from(new Set([...(m.readBy||[]), uid])) } : m));
    };
    const onDeleted = ({ conversationId: cid, messageId }: any) => {
      if (cid !== conversationId) return;
      setMessages(prev => prev.filter(m => m._id !== messageId));
    };
    socket.emit('chat:join', { conversationId });
    socket.emit('chat:history', { conversationId });
    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMsg);
    socket.on('chat:typing', onTyping);
    socket.on('chat:read', onRead);
    socket.on('chat:deleted', onDeleted);
    return () => {
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMsg);
      socket.off('chat:typing', onTyping);
      socket.off('chat:read', onRead);
      socket.off('chat:deleted', onDeleted);
    };
  }, [conversationId, userId, appendMessage]);

  // Typing emit debounce
  useEffect(() => {
    if (!conversationId || !userId) return;
    const socket = getSocket(userId);
    if (pendingText.trim().length > 0) {
      socket.emit('chat:typing', { conversationId, isTyping: true });
    }
    const t = setTimeout(() => {
      socket.emit('chat:typing', { conversationId, isTyping: false });
    }, 1200);
    return () => clearTimeout(t);
  }, [pendingText, conversationId, userId]);

  function send() {
    if (!pendingText.trim() || !conversationId || !userId) return;
    const text = pendingText.trim();
    setPendingText('');
    // Optimistic local message
    const optimistic: ChatMessage = {
      _id: `optim-${Date.now()}`,
      conversationId,
      senderId: userId,
      text,
      createdAt: new Date().toISOString(),
      readBy: [userId],
    };
    appendMessage(optimistic);
    const socket = getSocket(userId);
    socket.emit('chat:send', { conversationId, text });
  }

  function deleteMessage(messageId: string) {
    if (!conversationId || !userId) return;
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('Deleting message:', messageId);
            // Optimistically remove from UI
            setMessages(prev => prev.filter(m => m._id !== messageId));
            // Send delete request to server
            const socket = getSocket(userId);
            socket.emit('chat:delete', { conversationId, messageId });
            console.log('Emitted chat:delete event');
          }
        }
      ]
    );
  }

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.senderId === userId;
    const readByPeer = (item.readBy||[]).some(id => id !== userId);
    
    const handleLongPress = () => {
      if (mine && !item._id.startsWith('optim-')) {
        deleteMessage(item._id);
      }
    };
    
    return (
      <TouchableOpacity 
        style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={mine ? 0.7 : 1}
      >        
        {!mine && peerImage ? <Image source={{ uri: peerImage as string }} style={styles.msgAvatar} /> : null}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePeer]}>          
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
          <View style={[styles.metaRow, !mine && styles.metaRowPeer]}>
            <Text style={[styles.time, mine && styles.timeMine]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            {mine && (
              <View style={styles.checkmarks}>
                <Ionicons name="checkmark" size={14} color={readByPeer ? '#4CAF50' : 'rgba(255,255,255,0.7)'} style={styles.check1} />
                <Ionicons name="checkmark" size={14} color={readByPeer ? '#4CAF50' : 'rgba(255,255,255,0.7)'} style={styles.check2} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TopBarSecondary onBack={() => router.back()} title={typeof peerName === 'string' ? peerName : 'Chat'} />
        <ImageBackground
          source={require('@/assets/backgrounds/Chat.png')}
          style={styles.chatBackground}
          resizeMode="cover"
        >
          {loadingHistory ? (
            <View style={styles.loading}><ActivityIndicator color="#23395B" /></View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m._id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </ImageBackground>
        {peerTyping && <View style={styles.typingRow}><Text style={styles.typingText}>{peerName || 'User'} is typing…</Text></View>}
        <View style={[styles.composerRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.input}
            value={pendingText}
            onChangeText={setPendingText}
            placeholder="Message"
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, !pendingText.trim() && { opacity: 0.4 }]} onPress={send} disabled={!pendingText.trim()}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#1E1F24' },
  keyboardView: { flex: 1, backgroundColor: '#1E1F24' },
  chatBackground: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 40 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: '#23395B' },
  bubblePeer: { backgroundColor: '#E5E5EA' },
  bubbleText: { color: '#000' },
  bubbleTextMine: { color: '#fff' },
  time: { fontSize: 10, opacity: 0.6, color: '#000' },
  timeMine: { color: '#fff' },
  composerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1E1F24', backgroundColor: '#1E1F24' },
  input: { flex: 1, minHeight: 40, maxHeight: 100, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#2C2C2E', borderRadius: 16, color: '#fff' },
  sendBtn: { marginLeft: 8, backgroundColor: '#23395B', borderRadius: 18, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 6, alignSelf: 'flex-end' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  metaRowPeer: { justifyContent: 'flex-start' },
  checkmarks: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  check1: { marginRight: -8 },
  check2: {},
  readIndicator: { fontSize: 10, marginLeft: 8 },
  readSeen: { color: '#4caf50' },
  readPending: { color: '#999' },
  typingRow: { paddingHorizontal: 16, paddingBottom: 4, backgroundColor: '#1E1F24' },
  typingText: { fontSize: 12, color: '#23395B', fontStyle: 'italic' },
});
