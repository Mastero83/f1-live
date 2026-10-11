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

const Tab = createBottomTabNavigator();
const icon = (e: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{e}</Text>;

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer theme={DarkTheme}>
          <StatusBar style="light" />
          <Tab.Navigator screenOptions={{ headerStyle: { backgroundColor: '#e10600' }, headerTintColor: '#fff', tabBarActiveTintColor: '#e10600' }}>
            <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Klassement', tabBarIcon: icon('🏁') }} />
            <Tab.Screen name="Radio" component={RadioScreen} options={{ title: 'Teamradio', tabBarIcon: icon('📻') }} />
            <Tab.Screen name="RaceControl" component={RaceControlScreen} options={{ title: 'Wedstrijdleiding', tabBarIcon: icon('🚩') }} />
          </Tab.Navigator>
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
