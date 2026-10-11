import React, { useEffect, useState } from 'react';
import { Text, Pressable, Platform, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from './src/SessionContext';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import RadioScreen from './src/screens/RadioScreen';
import RaceControlScreen from './src/screens/RaceControlScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import TyresScreen from './src/screens/TyresScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import { LiveDataProvider } from './src/LiveData';
import { T } from './src/theme';

type Target = number | 'latest';
const Tab = createBottomTabNavigator();
const TABS = ['Leaderboard', 'Analyse', 'Banden', 'Radio', 'RaceControl'];
const web = Platform.OS === 'web' ? (globalThis as any) : null;
const params = () => new URLSearchParams((web?.location?.search as string | undefined) ?? '');
const tabParam = params().get('tab');
const initialTab = tabParam && TABS.includes(tabParam) ? tabParam : 'Leaderboard';
const parseTarget = (v: string | null): Target | null => (v === 'latest' ? 'latest' : v && /^\d+$/.test(v) ? Number(v) : null);
const icon = (e: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{e}</Text>;
const navTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: T.bg, card: '#111118', primary: T.red, border: T.border } };

export default function App() {
  // Start on the calendar unless the URL pins a session (?session=latest|<key>)
  const [target, setTarget] = useState<Target | null>(() => parseTarget(params().get('session')));

  // Web: keep URL + browser back button in sync
  useEffect(() => {
    if (!web) return;
    const onPop = () => setTarget(parseTarget(params().get('session')));
    web.addEventListener('popstate', onPop);
    return () => web.removeEventListener('popstate', onPop);
  }, []);
  const open = (t: Target | null) => {
    setTarget(t);
    if (web) { const u = new URL(web.location.href); u.searchParams.delete('tab'); t == null ? u.searchParams.delete('session') : u.searchParams.set('session', String(t)); web.history.pushState(null, '', u.toString()); }
  };
  const back = () => (web && web.history.length > 1 && params().get('session') ? web.history.back() : open(null));

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {target == null ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }} edges={['top']}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: T.red, backgroundColor: '#111118' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 }}>F1 <Text style={{ color: T.red }}>Live</Text> · Kalender</Text>
          </View>
          <CalendarScreen onOpen={open} />
        </SafeAreaView>
      ) : (
        <SessionProvider key={String(target)} target={target}>
          <LiveDataProvider>
            <NavigationContainer theme={navTheme}>
              <Tab.Navigator initialRouteName={initialTab} screenOptions={{
                headerStyle: { backgroundColor: '#111118', borderBottomWidth: 3, borderBottomColor: T.red }, headerTitleStyle: { fontWeight: '800', letterSpacing: 0.5 }, headerTintColor: '#fff',
                headerLeft: () => <Pressable onPress={back} hitSlop={10} style={{ paddingHorizontal: 14 }}><Text style={{ color: T.red, fontSize: 16, fontWeight: '800' }}>‹ Kalender</Text></Pressable>,
                tabBarActiveTintColor: T.red, tabBarInactiveTintColor: '#777', tabBarStyle: { backgroundColor: '#111118', borderTopColor: T.border }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
                <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Klassement', tabBarIcon: icon('🏁') }} />
                <Tab.Screen name="Analyse" component={AnalysisScreen} options={{ title: 'Analyse', tabBarIcon: icon('📈') }} />
                <Tab.Screen name="Banden" component={TyresScreen} options={{ title: 'Banden', tabBarIcon: icon('🛞') }} />
                <Tab.Screen name="Radio" component={RadioScreen} options={{ title: 'Teamradio', tabBarIcon: icon('📻') }} />
                <Tab.Screen name="RaceControl" component={RaceControlScreen} options={{ title: 'Wedstrijdleiding', tabBarLabel: 'Race Control', tabBarIcon: icon('🚩') }} />
              </Tab.Navigator>
            </NavigationContainer>
          </LiveDataProvider>
        </SessionProvider>
      )}
    </SafeAreaProvider>
  );
}
