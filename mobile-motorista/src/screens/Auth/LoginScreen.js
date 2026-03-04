import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.auth);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha email e senha');
      return;
    }

    dispatch(loginStart());
    try {
      const response = await authService.login(email, password);
      dispatch(loginSuccess(response.data));
    } catch (err) {
      dispatch(loginFailure(err.message));
      Alert.alert('Erro', 'Email ou senha inválidos');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.logo}
          defaultSource={require('../../../assets/logo-placeholder.png')}
        />
        <Text style={styles.title}>Mudex Motorista</Text>
        <Text style={styles.subtitle}>Ganhe dinheiro dirigindo</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.registerButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            Não tem conta? <Text style={styles.registerLink}>Cadastre-se</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotButton}>
          <Text style={styles.forgotText}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 8,
  },
  formContainer: {
    paddingHorizontal: 30,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  button: {
    height: 50,
    backgroundColor: '#27ae60',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  registerLink: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  forgotButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  forgotText: {
    color: '#3498db',
    fontSize: 14,
  },
});