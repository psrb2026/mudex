import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

// Main Screens
import HomeScreen from '../screens/Main/HomeScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';
import EarningsScreen from '../screens/Main/EarningsScreen';

// Ride Screens
import OnlineScreen from '../screens/Ride/OnlineScreen';
import RideHistoryScreen from '../screens/Ride/RideHistoryScreen';
import RideProgressScreen from '../screens/Ride/RideProgressScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function RideStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Online" component={OnlineScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RideProgress" component={RideProgressScreen} options={{ title: 'Corrida em Andamento' }} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} options={{ title: 'Histórico' }} />
    </Stack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let icon;
          
          if (route.name === 'Home') {
            icon = focused ? '🏠' : '🏠';
          } else if (route.name === 'Ride') {
            icon = focused ? '🚗' : '🚗';
          } else if (route.name === 'Earnings') {
            icon = focused ? '💰' : '💰';
          } else if (route.name === 'Profile') {
            icon = focused ? '👤' : '👤';
          }
          
          return <Text style={{ fontSize: size }}>{icon}</Text>;
        },
        tabBarActiveTintColor: '#27ae60',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início' }} />
      <Tab.Screen name="Ride" component={RideStack} options={{ title: 'Corridas' }} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Ganhos' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}