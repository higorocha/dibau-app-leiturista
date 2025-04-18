// src/screens/auth/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
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
// Importar esta dependência para tratar os erros de Axios
import Toast from 'react-native-toast-message';

const LoginScreen: React.FC = () => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  
  const isTablet = dimensions.width > 600;
  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
  
    return () => {
      subscription.remove();
    };
  }, []);

  // Modificar função de login para suprimir o toast indesejado
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Por favor, preencha todos os campos');
      return;
    }

    setIsLoading(true);
    try {
      // Este é um hack para evitar que o toast seja mostrado
      // Limpar/cancelar quaisquer toasts existentes
      Toast.hide();
      
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      // Cancelar toasts que o Axios possa ter disparado
      Toast.hide();
      
      // Mostrar apenas o Alert com a mensagem de erro
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
      <View style={[
        styles.contentGrid, 
        { flexDirection: isTablet && isLandscape ? 'row' : 'column' }
      ]}>
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
              <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={styles.scrollContent}
              >
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
          
          {/* NOVO RODAPÉ - Apenas na seção do formulário */}
          <View style={styles.footerContainer}>
            <View style={styles.footerContent}>
              <Text style={styles.footerText}>Sistemas de Informações - DIBAU</Text>
              
              <View style={styles.logosContainer}>
                {/* Logo DIBAU */}
                <View style={styles.logoWrapper}>
                  <Text style={styles.logoText}>DIBAU</Text>
                  <Image
                    source={require("../../../assets/images/logo.png")}
                    style={styles.footerLogo}
                    resizeMode="contain"
                  />
                </View>

                {/* Separador */}
                <View style={styles.divider}></View>

                {/* Logo DNOCS */}
                <View style={styles.logoWrapper}>
                  <Text style={styles.logoText}>DNOCS</Text>
                  <Image
                    source={require("../../../assets/images/dnocs.png")}
                    style={styles.footerLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Seção da imagem */}
        {isTablet && isLandscape && (
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
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 10, // Reduzir para acomodar o rodapé
    zIndex: 1,
    position: 'relative', // Importante para posicionar o rodapé
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    marginBottom: 16, // Adicionar espaço para o rodapé
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
    minHeight: 200,
  },
  scrollContent: {
    paddingVertical: 8,
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
    height: 48,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
  },
  togglePasswordButton: {
    padding: 12,
  },
  loginButton: {
    backgroundColor: '#1890ff',
    borderRadius: 4,
    height: 48,
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
  
  // Estilos para o novo rodapé
  footerContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  footerContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)', // Barra semitransparente
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  logosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  logoText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  footerLogo: {
    width: 40,
    height: 16,
  },
  divider: {
    height: 20,
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
});

export default LoginScreen;