import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { StatusBadge } from '../../components/StatusBadge';
import { Card } from '../../components/Card';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useSelector((state) => state.auth);
  const { stats } = useSelector((state) => state.ride);

  const menuItems = [
    {
      title: 'Ficar Online',
      icon: '🚗',
      color: '#27ae60',
      onPress: () => navigation.navigate('Online'),
    },
    {
      title: 'Minhas Corridas',
      icon: '📋',
      color: '#3498db',
      onPress: () => navigation.navigate('RideHistory'),
    },
    {
      title: 'Ganhos',
      icon: '💰',
      color: '#f39c12',
      onPress: () => navigation.navigate('Earnings'),
    },
    {
      title: 'Meu Perfil',
      icon: '👤',
      color: '#9b59b6',
      onPress: () => navigation.navigate('Profile'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Olá,</Text>
          <Text style={styles.nameText}>{user?.firstName || 'Motorista'}</Text>
          <StatusBadge 
            status={user?.documentsVerified ? 'approved' : 'pending'} 
          />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <Card
          title="Hoje"
          value={`R$ ${stats?.todayEarnings || '0,00'}`}
          subtitle={`${stats?.todayRides || 0} corridas`}
          color="#27ae60"
        />
        <Card
          title="Esta Semana"
          value={`R$ ${stats?.weekEarnings || '0,00'}`}
          subtitle={`${stats?.weekRides || 0} corridas`}
          color="#3498db"
        />
      </View>

      <View style={styles.ratingContainer}>
        <Text style={styles.ratingLabel}>Sua Avaliação</Text>
        <View style={styles.ratingRow}>
          <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
          <Text style={styles.ratingValue}>{user?.rating || '5.0'}</Text>
        </View>
        <Text style={styles.ratingCount}>
          Baseado em {user?.totalRides || 0} corridas
        </Text>
      </View>

      <View style={styles.menuContainer}>
        <Text style={styles.menuTitle}>Menu Rápido</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { backgroundColor: item.color }]}
              onPress={item.onPress}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!user?.documentsVerified && (
        <View style={styles.alertContainer}>
          <Text style={styles.alertTitle}>⚠️ Atenção</Text>
          <Text style={styles.alertText}>
            Seus documentos estão em análise. Você receberá uma notificação quando for aprovado.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    backgroundColor: '#27ae60',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  welcomeContainer: {
    alignItems: 'flex-start',
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    marginTop: -20,
  },
  ratingContainer: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    fontSize: 20,
    marginRight: 10,
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f39c12',
  },
  ratingCount: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 5,
  },
  menuContainer: {
    padding: 20,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: (width - 60) / 2,
    height: 100,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  alertContainer: {
    backgroundColor: '#fff3cd',
    margin: 20,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 5,
  },
  alertText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});