import api from './api';
import API_CONFIG from '../config/api';
import io from 'socket.io-client';

let socket = null;

export const rideService = {
  connectSocket: (userId, onDriverUpdate) => {
    socket = io(API_CONFIG.wsURL, {
      query: { userId, type: 'passenger' },
    });

    socket.on('driver-location', onDriverUpdate);
    return socket;
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  requestRide: async (data) => {
    const response = await api.post('/rides', data);
    return response.data;
  },

  cancelRide: async (rideId) => {
    const response = await api.post(`/rides/${rideId}/cancel`);
    return response.data;
  },

  getRideStatus: async (rideId) => {
    const response = await api.get(`/rides/${rideId}/status`);
    return response.data;
  },

  rateDriver: async (rideId, rating) => {
    const response = await api.post(`/rides/${rideId}/rate`, rating);
    return response.data;
  },

  getRideHistory: async () => {
    const response = await api.get('/rides/history');
    return response.data;
  },

  estimateFare: async (origin, destination) => {
    const response = await api.post('/rides/estimate', {
      origin,
      destination,
    });
    return response.data;
  },
};