import React, { createContext, useState, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  async function login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { user, accessToken } = response.data;
    setUser(user);
    await AsyncStorage.setItem('accessToken', accessToken);
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);