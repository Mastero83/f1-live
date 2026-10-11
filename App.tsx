import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from './src/SessionContext';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import RadioScreen from './src/screens/RadioScreen';
import RaceControlScreen from './src/screens/RaceControlScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import TyresScreen from './src/screens/TyresScreen';
import { LiveDataProvider } from './src/LiveData';
import { T } from './src/theme';

const Tab = createBottomTabNavigator();
const TABS = ['Leaderboard', 'Analyse', 'Banden', 'Radio', 'RaceControl'];
const search = ((globalThis as any).location?.search as string | undefined) ?? '';
const tabParam = new URLSearchParams(search).get('tab');
const initialTab = tabParam && TABS.includes(tabParam) ? tabParam : 'Leaderboard';
const icon = (e: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{e}</Text>;

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <LiveDataProvider>
        <NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: T.bg, card: '#111118', primary: T.red, border: T.border } }}>
          <StatusBar style="light" />
          <Tab.Navigator initialRouteName={initialTab} screenOptions={{ headerStyle: { backgroundColor: '#111118', borderBottomWidth: 3, borderBottomColor: T.red }, headerTitleStyle: { fontWeight: '800', letterSpacing: 0.5 }, headerTintColor: '#fff', tabBarActiveTintColor: T.red, tabBarInactiveTintColor: '#777', tabBarStyle: { backgroundColor: '#111118', borderTopColor: T.border }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
            <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Klassement', tabBarIcon: icon('🏁') }} />
            <Tab.Screen name="Analyse" component={AnalysisScreen} options={{ title: 'Analyse', tabBarIcon: icon('📈') }} />
            <Tab.Screen name="Banden" component={TyresScreen} options={{ title: 'Banden', tabBarIcon: icon('🛞') }} />
            <Tab.Screen name="Radio" component={RadioScreen} options={{ title: 'Teamradio', tabBarIcon: icon('📻') }} />
            <Tab.Screen name="RaceControl" component={RaceControlScreen} options={{ title: 'Wedstrijdleiding', tabBarLabel: 'Race Control', tabBarIcon: icon('🚩') }} />
          </Tab.Navigator>
        </NavigationContainer>
      </LiveDataProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
