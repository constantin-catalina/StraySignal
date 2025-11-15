import { ConversationSummary, fetchConversations } from '@/app/lib/chat';
import { getSocket } from '@/app/lib/socket';
import TopBar from '@/components/TopBar';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ChatList() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadInitial = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const list = await fetchConversations(userId);
      setConversations(list);
    } catch (e) {
      console.warn('Failed to fetch conversations', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const socket = getSocket(userId);
    const onConvos = (payload: ConversationSummary[]) => {
      setConversations(payload.sort((a,b) => (new Date(b.lastMessageAt||0).getTime()) - (new Date(a.lastMessageAt||0).getTime())));
    };
    const onUpdate = (updated: ConversationSummary) => {
      setConversations(prev => {
        const map = new Map(prev.map(p => [p._id, p]));
        map.set(updated._id, { ...map.get(updated._id), ...updated });
        return Array.from(map.values()).sort((a,b) => (new Date(b.lastMessageAt||0).getTime()) - (new Date(a.lastMessageAt||0).getTime()));
      });
    };
    socket.emit('chat:list');
    socket.on('chat:conversations', onConvos);
    socket.on('chat:conversation:update', onUpdate);
    return () => {
      socket.off('chat:conversations', onConvos);
      socket.off('chat:conversation:update', onUpdate);
    };
  }, [userId]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const list = await fetchConversations(userId);
      setConversations(list);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  function formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const msgDate = new Date(dateStr);
    const now = new Date();
    const isToday = msgDate.toDateString() === now.toDateString();
    if (isToday) {
      return msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderItem({ item }: { item: ConversationSummary }) {
    const peerName = item.peer?.name || item.peer?.id || 'User';
    const isSentByMe = item.lastSenderId === userId;
    const avatarUri = item.peer?.profileImage;
    const unreadCount = item.unreadCount || 0;
    
    let lastText = item.lastMessageText || 'No messages yet';
    let showReadStatus = false;
    let isRead = false;
    
    if (item.lastMessageText) {
      if (isSentByMe) {
        showReadStatus = true;
        isRead = (item.lastMessageReadBy || []).some(id => id !== userId);
        lastText = `You: ${item.lastMessageText}`;
        if (lastText.length > 50) lastText = lastText.slice(0, 50) + '…';
      } else {
        if (lastText.length > 60) lastText = lastText.slice(0, 60) + '…';
      }
    }
    
    const timeStr = formatTime(item.lastMessageAt);
    
    return (
      <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: `/chat/${item._id}`, params: { peerName, peerImage: avatarUri || '' } })}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarCircle}><Text style={styles.avatarText}>{peerName.slice(0,1).toUpperCase()}</Text></View>
        )}
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, unreadCount > 0 && styles.nameUnread]}>{peerName}</Text>
            <View style={styles.timeStatusRow}>
              {timeStr && <Text style={styles.time}>{timeStr}</Text>}
              {showReadStatus && (
                <View style={styles.checkmarks}>
                  <Ionicons name="checkmark" size={14} color={isRead ? '#4CAF50' : '#999'} style={styles.check1} />
                  <Ionicons name="checkmark" size={14} color={isRead ? '#4CAF50' : '#999'} style={styles.check2} />
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.last, unreadCount > 0 && styles.lastUnread]} numberOfLines={1}>{lastText}</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  function normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  const filteredConversations = conversations.filter(c => {
    const peerName = c.peer?.name || c.peer?.id || '';
    return normalizeString(peerName).includes(normalizeString(searchQuery));
  });

  return (
    <View style={styles.container}>
      <TopBar showRightDots={true} />
      
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.profilePic} />
          ) : (
            <View style={styles.profilePicPlaceholder}>
              <Text style={styles.profileInitial}>{user?.firstName?.charAt(0) || 'U'}</Text>
            </View>
          )}
          <Text style={styles.chatsTitle}>Chats</Text>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      {loading && conversations.length === 0 ? (
        <View style={styles.loadingBox}><ActivityIndicator color="#23395B" /><Text style={styles.loadingText}>Loading chats…</Text></View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={c => c._id}
          renderItem={renderItem}
          contentContainerStyle={filteredConversations.length === 0 && styles.emptyContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>{searchQuery ? 'No matches found' : 'No conversations yet'}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: '#C4D5E0', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e1e1' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profilePic: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  profilePicPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#23395B', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileInitial: { color: '#fff', fontSize: 18, fontWeight: '600' },
  chatsTitle: { fontSize: 28, fontWeight: 'bold', color: '#1E1F24' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1E1F24' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  loadingText: { marginLeft: 12, color: '#23395B' },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e1e1e1' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#23395B', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  meta: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: '#1E1F24', flex: 1 },
  nameUnread: { color: '#23395B' },
  timeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 12, color: '#999' },
  checkmarks: { flexDirection: 'row', alignItems: 'center', marginLeft: 2 },
  check1: { marginRight: -8 },
  check2: {},
  last: { fontSize: 13, color: '#555' },
  lastUnread: { fontWeight: '600', color: '#23395B' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#23395B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, alignSelf: 'center' },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#23395B', fontSize: 16 },
});
