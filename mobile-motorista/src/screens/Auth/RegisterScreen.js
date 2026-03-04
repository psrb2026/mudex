import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';

const steps = ['Dados Pessoais', 'Documentos', 'Veículo', 'Senha'];

export default function RegisterScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    cpf: '',
    licenseNumber: '',
    licenseCategory: 'B',
    licenseExpiry: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    licensePlate: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = () => {
    switch (currentStep) {
      case 0:
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
          Alert.alert('Erro', 'Preencha todos os campos');
          return false;
        }
        break;
      case 1:
        if (!formData.cpf || !formData.licenseNumber) {
          Alert.alert('Erro', 'Preencha todos os documentos');
          return false;
        }
        break;
      case 2:
        if (!formData.vehicleModel || !formData.licensePlate) {
          Alert.alert('Erro', 'Preencha os dados do veículo');
          return false;
        }
        break;
      case 3:
        if (formData.password.length < 6) {
          Alert.alert('Erro', 'Senha deve ter no mínimo 6 caracteres');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          Alert.alert('Erro', 'As senhas não conferem');
          return false;
        }
        break;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleRegister();
      }
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await authService.registerDriver(formData);
      Alert.alert(
        'Sucesso!',
        'Cadastro realizado. Aguarde aprovação dos documentos.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (err) {
      Alert.alert('Erro', err.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View>
            <Text style={styles.stepTitle}>Dados Pessoais</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              value={formData.firstName}
              onChangeText={(text) => updateField('firstName', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Sobrenome"
              value={formData.lastName}
              onChangeText={(text) => updateField('lastName', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefone"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => updateField('phone', text)}
            />
          </View>
        );

      case 1:
        return (
          <View>
            <Text style={styles.stepTitle}>Documentos</Text>
            <TextInput
              style={styles.input}
              placeholder="CPF"
              keyboardType="numeric"
              value={formData.cpf}
              onChangeText={(text) => updateField('cpf', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Número da CNH"
              value={formData.licenseNumber}
              onChangeText={(text) => updateField('licenseNumber', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Categoria (A, B, C, D, E)"
              value={formData.licenseCategory}
              onChangeText={(text) => updateField('licenseCategory', text)}
              maxLength={1}
            />
            <TextInput
              style={styles.input}
              placeholder="Validade da CNH (DD/MM/AAAA)"
              value={formData.licenseExpiry}
              onChangeText={(text) => updateField('licenseExpiry', text)}
            />
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Dados do Veículo</Text>
            <TextInput
              style={styles.input}
              placeholder="Modelo do Veículo"
              value={formData.vehicleModel}
              onChangeText={(text) => updateField('vehicleModel', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Ano"
              keyboardType="numeric"
              value={formData.vehicleYear}
              onChangeText={(text) => updateField('vehicleYear', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Cor"
              value={formData.vehicleColor}
              onChangeText={(text) => updateField('vehicleColor', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Placa"
              autoCapitalize="characters"
              value={formData.licensePlate}
              onChangeText={(text) => updateField('licensePlate', text)}
            />
          </View>
        );

      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>Criar Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="Senha"
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar Senha"
              secureTextEntry
              value={formData.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
            />
          </View>
        );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cadastro de Motorista</Text>
        <View style={styles.progressContainer}>
          {steps.map((step, index) => (
            <View
              key={index}
              style={[
                styles.progressStep,
                index <= currentStep && styles.progressStepActive,
              ]}
            >
              <Text style={[
                styles.progressText,
                index <= currentStep && styles.progressTextActive,
              ]}>
                {index + 1}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.formContainer}>
        {renderStep()}

        <View style={styles.buttonContainer}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Text style={styles.buttonSecondaryText}>Voltar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
            onPress={nextStep}
            disabled={loading}
          >
            <Text style={styles.buttonPrimaryText}>
              {loading ? 'Processando...' : currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    backgroundColor: '#27ae60',
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  progressStep: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  progressStepActive: {
    backgroundColor: '#fff',
  },
  progressText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  progressTextActive: {
    color: '#27ae60',
  },
  formContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonPrimary: {
    backgroundColor: '#27ae60',
  },
  buttonSecondary: {
    backgroundColor: '#ecf0f1',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSecondaryText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: 'bold',
  },
});