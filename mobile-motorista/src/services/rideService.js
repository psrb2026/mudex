import api from './api';
import API_CONFIG from '../config/api';
import io from 'socket.io-client';

let socket = null;

export const rideService = {
  // Socket para localização em tempo real
  connectSocket: (driverId, onRideRequest) => {
    socket = io(API_CONFIG.wsURL, {
      query: { driverId, type: 'driver' },
    });

    socket.on('connect', () => {
      console.log('Socket conectado');
    });

    socket.on('ride-request', onRideRequest);

    socket.on('disconnect', () => {
      console.log('Socket desconectado');
    });

    return socket;
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  updateLocation: (location) => {
    if (socket) {
      socket.emit('location-update', location);
    }
  },

  goOnline: (data) => {
    if (socket) {
      socket.emit('driver-online', data);
    }
  },

  goOffline: () => {
    if (socket) {
      socket.emit('driver-offline');
    }
  },

  acceptRide: (rideId) => {
    if (socket) {
      socket.emit('accept-ride', { rideId });
    }
  },

  declineRide: (rideId) => {
    if (socket) {
      socket.emit('decline-ride', { rideId });
    }
  },

  // HTTP APIs
  getRideHistory: async () => {
    const response = await api.get('/rides/driver/history');
    return response.data;
  },

  getEarnings: async (period = 'today') => {
    const response = await api.get(`/analytics/earnings?period=${period}`);
    return response.data;
  },

  completeRide: async (rideId, data) => {
    const response = await api.post(`/rides/${rideId}/complete`, data);
    return response.data;
  },
};