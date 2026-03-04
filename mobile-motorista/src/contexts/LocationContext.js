import React, { createContext, useState, useEffect, useContext } from 'react';
import * as Location from 'expo-location';

const LocationContext = createContext({});

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
      }
    })();
  }, []);

  return (
    <LocationContext.Provider value={{ location }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);