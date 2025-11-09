import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './themed-text';

export default function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isSignal = route.name === 'signal';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const getIcon = () => {
          switch (route.name) {
            case 'home':
              return 'home';
            case 'inbox':
              return 'notifications';
            case 'signal':
              return 'paw';
            case 'chat':
              return 'chatbubbles';
            case 'profile':
              return 'person';
            default:
              return 'ellipse';
          }
        };

        const getLabel = () => {
          switch (route.name) {
            case 'home':
              return 'Home';
            case 'inbox':
              return 'Inbox';
            case 'signal':
              return 'Signal';
            case 'chat':
              return 'Chat';
            case 'profile':
              return 'Profile';
            default:
              return route.name;
          }
        };

        if (isSignal) {
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.signalContainer}
            >
              <View style={styles.signalButtonOuter}>
                <View style={styles.signalButtonInner}>
                  <Ionicons
                    name={getIcon() as any}
                    size={32}
                    color="#D9D9D9"               
                  />
                </View>
              </View>
              <ThemedText
                style={[
                  styles.label,
                  { color: isFocused ? '#D9D9D9' : '#6B9AC4' }
                ]}
              >
                {getLabel()}
              </ThemedText>
            </TouchableOpacity>
          );
        }


        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
          >
            <Ionicons
              name={getIcon() as any}
              size={24}
              color={isFocused ? '#D9D9D9' : '#6B9AC4'}
            />
            <ThemedText
              style={[
                styles.label,
                { color: isFocused ? '#D9D9D9' : '#6B9AC4'}
              ]}
            >
              {getLabel()}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
  paddingBottom: Platform.OS === 'ios' ? 44 : 34,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#38383A',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  signalContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  signalButtonOuter: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#2C3E50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#1C1C1E',
    marginTop: -44,
  },
  signalButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#81ADC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
});