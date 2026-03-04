import React from 'react';
import { useSelector } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';

export default function RootNavigator() {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // Verifica se usuário está autenticado e documentos verificados
  const canAccessApp = isAuthenticated && user?.documentsVerified;

  return canAccessApp ? <AppNavigator /> : <AuthNavigator />;
}