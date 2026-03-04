import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Alert
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  
  const [location, setLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeRide, setActiveRide] = useState(null);

  useEffect(() => {
    requestLocationPermission();
    startLocationTracking();
    
    // Escuta por atualizações de motoristas próximos
    if (socket) {
      socket.on('drivers:nearby', (data) => {
        setDrivers(data.drivers);
      });
      
      socket.on('ride:update', (data) => {
        handleRideUpdate(data);
      });
    }

    return () => {
      if (socket) {
        socket.off('drivers:nearby');
        socket.off('ride:update');
      }
    };
  }, [socket]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da sua localização para funcionar');
    }
  };

  const startLocationTracking = async () => {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    setLocation(location.coords);
    
    // Atualiza a cada 3 segundos
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 10
      },
      (newLocation) => {
        setLocation(newLocation.coords);
        
        // Envia para servidor se tiver corrida ativa
        if (activeRide && socket) {
          socket.emit('customer:location', {
            ride_id: activeRide.id,
            location: newLocation.coords
          });
        }
      }
    );
  };

  const handleRideUpdate = (data) => {
    switch (data.type) {
      case 'DRIVER_ASSIGNED':
        setActiveRide({ ...activeRide, status: 'accepted', driver: data.driver });
        Alert.alert('Motorista encontrado!', `${data.driver.name} está a caminho`);
        break;
      case 'DRIVER_ARRIVED':
        Alert.alert('Motorista chegou!', 'Seu motorista está no local de embarque');
        break;
      case 'RIDE_STARTED':
        setActiveRide({ ...activeRide, status: 'in_progress' });
        break;
      case 'RIDE_COMPLETED':
        Alert.alert('Corrida finalizada', `Total: R$ ${data.final_price}`);
        setActiveRide(null);
        break;
      case 'RIDE_CANCELLED':
        Alert.alert('Corrida cancelada', data.reason);
        setActiveRide(null);
        setIsSearching(false);
        break;
    }
  };

  const requestRide = async () => {
    if (!destination) {
      Alert.alert('Erro', 'Selecione um destino');
      return;
    }

    try {
      setIsSearching(true);
      
      const response = await api.post('/rides/request', {
        pickup_latitude: location.latitude,
        pickup_longitude: location.longitude,
        dropoff_latitude: destination.latitude,
        dropoff_longitude: destination.longitude,
        vehicle_type: 'economy',
        payment_method: 'credit_card'
      });

      setActiveRide({
        id: response.data.ride_id,
        status: 'searching',
        estimated_price: response.data.estimated_price
      });

      // Inicia tracking via Socket.io
      socket.emit('ride:track', { ride_id: response.data.ride_id });

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível solicitar corrida');
      setIsSearching(false);
    }
  };

  const cancelRide = async () => {
    if (!activeRide) return;
    
    try {
      await api.post(`/rides/${activeRide.id}/cancel`, {
        reason: 'Cancelado pelo cliente'
      });
      setActiveRide(null);
      setIsSearching(false);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cancelar');
    }
  };

  if (!location) {
    return (
      <View style={styles.container}>
        <Text>Obtendo localização...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation
        followsUserLocation
      >
        {/* Motoristas próximos */}
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.location.latitude,
              longitude: driver.location.longitude
            }}
            title={`Motorista - ${driver.rating}★`}
            pinColor="blue"
          />
        ))}

        {/* Destino selecionado */}
        {destination && (
          <Marker
            coordinate={destination}
            title="Destino"
            pinColor="red"
          />
        )}

        {/* Rota (simplificada) */}
        {destination && (
          <Polyline
            coordinates={[location, destination]}
            strokeColor="#000"
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* UI Overlay */}
      <View style={styles.overlay}>
        {activeRide ? (
          <View style={styles.ridePanel}>
            <Text style={styles.statusText}>
              Status: {activeRide.status === 'searching' ? 'Buscando motorista...' : 
                       activeRide.status === 'accepted' ? 'Motorista a caminho' :
                       activeRide.status === 'in_progress' ? 'Em andamento' : activeRide.status}
            </Text>
            {activeRide.driver && (
              <Text>Motorista: {activeRide.driver.name}</Text>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={cancelRide}>
              <Text style={styles.buttonText}>Cancelar Corrida</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.requestButton}
            onPress={requestRide}
            disabled={isSearching}
          >
            <Text style={styles.buttonText}>
              {isSearching ? 'Buscando...' : 'Solicitar Mudex'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  requestButton: {
    backgroundColor: '#000',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ridePanel: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  }
});