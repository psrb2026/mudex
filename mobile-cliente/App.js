import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>TESTE CLIENTE</Text>
      <Text style={styles.subtext}>Porta 8081</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db', // AZUL para identificar
  },
  text: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  subtext: {
    fontSize: 16,
    color: '#fff',
    marginTop: 10,
  },
});