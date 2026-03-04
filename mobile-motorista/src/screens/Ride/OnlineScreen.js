import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import io from 'socket.io-client';

const { width, height } = Dimensions.get('window');

export default function OnlineScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [region, setRegion] = useState(null);
  const [rideRequest, setRideRequest] = useState(null);
  const [countdown, setCountdown] = useState(15);
  
  const socketRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da sua localização para funcionar');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      setLocation({ latitude, longitude });
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();

    // Animação de pulso
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (isOnline && location) {
      // Conectar ao socket
      socketRef.current = io('http://localhost:3005'); // location-service
      
      socketRef.current.emit('driver-online', {
        driverId: user.id,
        location: {
          lat: location.latitude,
          lng: location.longitude,
        },
        vehicleType: user.vehicleType || 'economy',
      });

      // Escutar solicitações de corrida
      socketRef.current.on('ride-request', (data) => {
        setRideRequest(data);
        setCountdown(15);
      });

      // Atualizar localização periodicamente
      const interval = setInterval(async () => {
        const newLocation = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = newLocation.coords;
        
        setLocation({ latitude, longitude });
        
        socketRef.current.emit('location-update', {
          driverId: user.id,
          location: { lat: latitude, lng: longitude },
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isOnline, location]);

  // Countdown para aceitar corrida
  useEffect(() => {
    if (rideRequest && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && rideRequest) {
      // Recusar automaticamente
      handleDecline();
    }
  }, [countdown, rideRequest]);

  const toggleOnline = () => {
    if (!isOnline) {
      setIsOnline(true);
      Alert.alert('Você está online!', 'Aguardando solicitações de corrida...');
    } else {
      setIsOnline(false);
      if (socketRef.current) {
        socketRef.current.emit('driver-offline', { driverId: user.id });
      }
    }
  };

  const handleAccept = () => {
    if (socketRef.current) {
      socketRef.current.emit('accept-ride', {
        driverId: user.id,
        rideId: rideRequest.id,
      });
    }
    setRideRequest(null);
    navigation.navigate('RideProgress', { ride: rideRequest });
  };

  const handleDecline = () => {
    if (socketRef.current) {
      socketRef.current.emit('decline-ride', {
        driverId: user.id,
        rideId: rideRequest.id,
      });
    }
    setRideRequest(null);
    setCountdown(15);
  };

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Obtendo localização...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        followsUserLocation={isOnline}
      >
        {location && isOnline && (
          <>
            <Marker coordinate={location}>
              <View style={styles.markerContainer}>
                <Animated.View
                  style={[
                    styles.pulse,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.marker} />
              </View>
            </Marker>
            <Circle
              center={location}
              radius={1000}
              strokeColor="rgba(39, 174, 96, 0.5)"
              fillColor="rgba(39, 174, 96, 0.1)"
            />
          </>
        )}
        
        {rideRequest && (
          <Marker
            coordinate={{
              latitude: rideRequest.pickup.lat,
              longitude: rideRequest.pickup.lng,
            }}
            title="Passageiro"
          >
            <View style={styles.passengerMarker}>
              <Text style={styles.passengerIcon}>👤</Text>
            </View>
          </Marker>
        )}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {isOnline ? '🟢 Online' : '⚪ Offline'}
        </Text>
      </View>

      {/* Botão Online/Offline */}
      <TouchableOpacity
        style={[
          styles.onlineButton,
          isOnline ? styles.onlineButtonActive : styles.onlineButtonInactive,
        ]}
        onPress={toggleOnline}
      >
        <Text style={styles.onlineButtonText}>
          {isOnline ? 'FICAR OFFLINE' : 'FICAR ONLINE'}
        </Text>
      </TouchableOpacity>

      {/* Card de solicitação de corrida */}
      {rideRequest && (
        <View style={styles.rideRequestCard}>
          <View style={styles.rideRequestHeader}>
            <Text style={styles.rideRequestTitle}>Nova solicitação!</Text>
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          </View>

          <View style={styles.rideInfo}>
            <Text style={styles.passengerName}>
              {rideRequest.passengerName || 'Passageiro'}
            </Text>
            <View style={styles.ratingContainer}>
              <Text>⭐ {rideRequest.passengerRating || '5.0'}</Text>
            </View>
          </View>

          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>📍 Origem</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {rideRequest.pickup?.address || 'Local de embarque'}
            </Text>
            
            <Text style={styles.locationLabel}>🏁 Destino</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {rideRequest.destination?.address || 'Local de destino'}
            </Text>
          </View>

          <View style={styles.rideStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{rideRequest.distance || '0'}</Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{rideRequest.duration || '0'}</Text>
              <Text style={styles.statLabel}>min</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>R$ {rideRequest.price || '0'}</Text>
              <Text style={styles.statLabel}>valor</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={handleDecline}
            >
              <Text style={styles.declineButtonText}>Recusar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
            >
              <Text style={styles.acceptButtonText}>Aceitar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Estatísticas quando online */}
      {isOnline && !rideRequest && (
        <View style={styles.statsOverlay}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>R$ 0,00</Text>
            <Text style={styles.statBoxLabel}>Ganhos hoje</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>0</Text>
            <Text style={styles.statBoxLabel}>Corridas</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: width,
    height: height,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(39, 174, 96, 0.3)',
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27ae60',
    borderWidth: 3,
    borderColor: '#fff',
  },
  passengerMarker: {
    backgroundColor: '#3498db',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  passengerIcon: {
    fontSize: 20,
  },
  onlineButton: {
    position: 'absolute',
    bottom: 100,
    left: 50,
    right: 50,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  onlineButtonInactive: {
    backgroundColor: '#27ae60',
  },
  onlineButtonActive: {
    backgroundColor: '#e74c3c',
  },
  onlineButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rideRequestCard: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  rideRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  rideRequestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  countdownBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countdownText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rideInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginRight: 10,
  },
  ratingContainer: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationInfo: {
    marginBottom: 15,
  },
  locationLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  rideStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ecf0f1',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  declineButton: {
    backgroundColor: '#ecf0f1',
  },
  declineButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: 'bold',
  },
  acceptButton: {
    backgroundColor: '#27ae60',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsOverlay: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
});