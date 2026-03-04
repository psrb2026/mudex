import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentRide: null,
  rideHistory: [],
  stats: {
    todayEarnings: 0,
    todayRides: 0,
    weekEarnings: 0,
    weekRides: 0,
  },
  loading: false,
  error: null,
};

const rideSlice = createSlice({
  name: 'ride',
  initialState,
  reducers: {
    setCurrentRide: (state, action) => {
      state.currentRide = action.payload;
    },
    clearCurrentRide: (state) => {
      state.currentRide = null;
    },
    addRideToHistory: (state, action) => {
      state.rideHistory.unshift(action.payload);
    },
    updateStats: (state, action) => {
      state.stats = { ...state.stats, ...action.payload };
    },
    setRideHistory: (state, action) => {
      state.rideHistory = action.payload;
    },
  },
});

export const { setCurrentRide, clearCurrentRide, addRideToHistory, updateStats, setRideHistory } = rideSlice.actions;
export default rideSlice.reducer;