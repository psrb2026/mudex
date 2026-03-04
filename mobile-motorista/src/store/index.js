import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import rideReducer from './slices/rideSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ride: rideReducer,
  },
});