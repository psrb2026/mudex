import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', {
      email,
      password,
      userType: 'passenger',
    });
    
    await AsyncStorage.setItem('token', response.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    
    return response.data;
  },

  register: async (data) => {
    const response = await api.post('/auth/register-passenger', data);
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    await AsyncStorage.multiRemove(['token', 'user']);
  },

  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },
};