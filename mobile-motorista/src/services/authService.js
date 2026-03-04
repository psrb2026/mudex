import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
      userType: 'driver',
    });
    
    await AsyncStorage.setItem('token', response.data.token);
    await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
    
    return response.data;
  },

  register: async (data) => {
    const response = await api.post('/auth/register-driver', data);
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
  },

  getProfile: async () => {
    const response = await api.get('/users/profile');
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },
};