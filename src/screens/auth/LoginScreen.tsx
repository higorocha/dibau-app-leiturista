// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import BackgroundIcons from './BackgroundIcons';

// Obter dimensões da tela
const { width, height } = Dimensions.get('window');
const isTablet = width > 768;

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error.response?.data?.message || 
                     'Email ou senha incorretos.';
      Alert.alert('Erro de Autenticação', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background com ícones */}
      <BackgroundIcons />

      {/* Container principal */}
      <View style={styles.contentGrid}>
        {/* Seção do formulário */}
        <View style={styles.formSection}>
          <View style={styles.cardContainer}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/images/logoEstendido.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.welcomeTitle}>Bem-vindo ao DIBAU</Text>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.formContainer}
            >
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color="rgba(0,0,0,0.45)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="rgba(0,0,0,0.45)"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="rgba(0,0,0,0.45)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Senha"
                      placeholderTextColor="rgba(0,0,0,0.45)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.togglePasswordButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={20} 
                        color="rgba(0,0,0,0.45)" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Entrar</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </View>

        {/* Seção da imagem (visível apenas em tablets) */}
        {isTablet && (
          <View style={styles.imageSection}>
            <Image 
              source={require('../../../assets/images/irrigation.png')}
              style={styles.irrigationImage}
              resizeMode="cover"
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentGrid: {
    flex: 1,
    flexDirection: isTablet ? 'row' : 'column',
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 24,
    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.1)',
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 300,
    height: 60,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  formContainer: {
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  inputIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    height: 48, // Tamanho grande como no antd 'large'
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
  },
  togglePasswordButton: {
    padding: 12,
  },
  loginButton: {
    backgroundColor: '#1890ff', // cor primária do Ant Design
    borderRadius: 4,
    height: 48, // Match the input height
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imageSection: {
    flex: 1,
    overflow: 'hidden',
  },
  irrigationImage: {
    width: '100%',
    height: '100%',
  },
});

export default LoginScreen;