import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; // Garanta que seu api.js está com o IP 192.168.15.6

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      const storageUser = await AsyncStorage.getItem('@Mudex:user');
      const storageToken = await AsyncStorage.getItem('accessToken');

      if (storageUser && storageToken) {
        api.defaults.headers.Authorization = `Bearer ${storageToken}`;
        setUser(JSON.parse(storageUser));
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  async function login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data;

      setUser(user);
      api.defaults.headers.Authorization = `Bearer ${accessToken}`;

      await AsyncStorage.setItem('@Mudex:user', JSON.stringify(user));
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Erro no login' };
    }
  }

  function logout() {
    AsyncStorage.multiRemove(['@Mudex:user', 'accessToken', 'refreshToken']).then(() => {
      setUser(null);
    });
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}