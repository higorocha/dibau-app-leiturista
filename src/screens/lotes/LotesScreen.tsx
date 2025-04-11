// src/screens/lotes/LotesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  Alert
} from 'react-native';
import api from '../../api/axiosConfig';
import { useAuth } from '../../contexts/AuthContext';
import ErrorMessage from '../../components/ErrorMessage';

// Tipos
interface Cultura {
  id: number;
  descricao: string;
}

interface Cliente {
  id: number;
  nome: string;
}

interface Lote {
  id: number;
  nomeLote: string;
  areaTotal: number;
  categoria: string;
  situacao: string;
  Cliente?: Cliente;
  Culturas?: Cultura[];
}

// Verificar se é tablet
const { width } = Dimensions.get('window');
const isTablet = width > 600;

const LotesScreen: React.FC = () => {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();

  const carregarLotes = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/lotesagricolas');
      setLotes(response.data);
      console.log(`Carregados ${response.data.length} lotes`);
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
      setError('Falha ao carregar os lotes. Verifique sua conexão.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarLotes();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarLotes();
  };

  // Função para cor da categoria
  const getCategoriaColor = (categoria: string): string => {
    switch (categoria) {
      case 'Colono': return '#2a9d8f';
      case 'Tecnico': return '#e9c46a';
      case 'Empresarial': return '#f4a261';
      case 'Adjacente': return '#e76f51';
      default: return '#999999';
    }
  };

  const renderItem = ({ item }: { item: Lote }) => {
    // Verificar se item.Cliente existe
    const clienteNome = item.Cliente?.nome || 'Cliente não informado';
    const categoria = item.categoria || 'Sem categoria';
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          // Futuramente navegará para detalhes do lote
          Alert.alert("Lote selecionado", `${item.nomeLote}`);
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.loteNome}>{item.nomeLote}</Text>
          <View style={[
            styles.categoriaBadge,
            { backgroundColor: getCategoriaColor(categoria) }
          ]}>
            <Text style={styles.categoriaText}>{categoria}</Text>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <Text style={styles.clienteNome}>Responsável: {clienteNome}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Área Total:</Text>
            <Text style={styles.infoValue}>{item.areaTotal} ha</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Situação:</Text>
            <Text style={[
              styles.situacaoText,
              {color: item.situacao === 'Operacional' ? '#2a9d8f' : '#e63946'}
            ]}>
              {item.situacao || 'Não informada'}
            </Text>
          </View>
          
          {item.Culturas && item.Culturas.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Culturas:</Text>
              <Text style={styles.infoValue}>
                {item.Culturas.map(c => c.descricao).join(', ')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lotes Agrícolas</Text>
          <Text style={styles.headerSubtitle}>
            {user?.nome ? `Olá, ${user.nome.split(' ')[0]}` : 'Bem-vindo'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              "Sair do Aplicativo",
              "Tem certeza que deseja sair?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", onPress: () => logout() }
              ]
            );
          }}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ErrorMessage error={error} visible={!!error} />

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a9d8f" />
          <Text style={styles.loadingText}>Carregando lotes...</Text>
        </View>
      ) : (
        <FlatList
          data={lotes}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={["#2a9d8f"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum lote encontrado</Text>
              <TouchableOpacity 
                style={styles.reloadButton}
                onPress={carregarLotes}
              >
                <Text style={styles.reloadButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 30 : 16,
    paddingVertical: isTablet ? 20 : 16,
    backgroundColor: '#2a9d8f',
  },
  headerTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: isTablet ? 16 : 14,
  },
  listContent: {
    padding: isTablet ? 24 : 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isTablet ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  loteNome: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  categoriaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoriaText: {
    color: 'white',
    fontSize: isTablet ? 14 : 12,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: isTablet ? 20 : 16,
  },
  clienteNome: {
    fontSize: isTablet ? 18 : 16,
    marginBottom: 12,
    color: '#555',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: isTablet ? 16 : 14,
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: isTablet ? 16 : 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  situacaoText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: isTablet ? 18 : 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: isTablet ? 18 : 16,
    color: '#999',
    marginBottom: 16,
  },
  reloadButton: {
    backgroundColor: '#2a9d8f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 5,
  },
  reloadButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: isTablet ? 16 : 14,
  },
});

export default LotesScreen;