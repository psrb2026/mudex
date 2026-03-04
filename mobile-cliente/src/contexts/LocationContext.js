import React, { createContext, useState, useEffect, useContext } from 'react';
import * as Location from 'expo-location';

const LocationContext = createContext({});

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permissão de localização negada');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation.coords);

      // Monitora a posição em tempo real
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (newLocation) => {
          setLocation(newLocation.coords);
        }
      );
    })();
  }, []);

  return (
    <LocationContext.Provider value={{ location, errorMsg }}>
      {children}
    </LocationContext.Provider>
  );
};

export function useLocation() {
  return useContext(LocationContext);
}