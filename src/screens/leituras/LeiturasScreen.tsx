// src/screens/leituras/LeiturasScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLeiturasContext } from "../../contexts/LeiturasContext";
import api from "../../api/axiosConfig";
import LeituraCard from "../../components/leituras/LeituraCard";
import ErrorMessage from "../../components/ErrorMessage";
import { useTheme } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

// Interface para o objeto de leitura mensal
interface Fatura {
  id: number;
  valor_leitura_m3: number;
  valor_monetario: number;
  valor_parte_fixa: number;
  valor_total: number;
  status: string;
  fechada: string;
  Tarifas?: any[];
  mes_leitura: number;
  ano_leitura: number;
  [key: string]: any;
}

interface LeituraMensal {
  mesAno: string;
  quantidadeLeituras?: number;
  valorTotal: number;
  valorMonetario: number;
  valorParteFixa: number;
  volumeTotal: number;
  dataCriacao: string;
  leiturasInformadas: number;
  totalLeituras: number;
  faturas: Fatura[];
  isAllFechada: boolean;
}

const LeiturasScreen: React.FC = () => {
  const [leituras, setLeituras] = useState<LeituraMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const { user } = useAuth();
  const { colors } = useTheme();
  const { setFaturasSelecionadas, setMesAnoSelecionado } = useLeiturasContext();

  // Função para verificar conexão
  const checkConnection = async () => {
    const netInfo = await NetInfo.fetch();
    setIsOffline(!netInfo.isConnected);
    return netInfo.isConnected;
  };

  // Função para carregar dados offline
  const carregarDadosOffline = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('leituras_data');
      const timestamp = await AsyncStorage.getItem('leituras_timestamp');
      
      if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        setLeituras(dados);
        setLastSyncTime(timestamp);
        setHasMore(false);
        
        Toast.show({
          type: 'info',
          text1: 'Modo offline',
          text2: `Usando dados salvos em ${new Date(timestamp || '').toLocaleString()}`,
          visibilityTime: 3000,
        });
      } else {
        setError("Nenhum dado disponível para uso offline");
      }
    } catch (error) {
      console.error("Erro ao carregar dados offline:", error);
      setError("Erro ao carregar dados salvos");
    }
  };

  const carregarLeituras = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError("");

      // Verificar conexão
      const isConnected = await checkConnection();
      
      if (isConnected) {
        // MODO ONLINE: Buscar da API
        try {
          // URL específica para o app - carrega tudo de uma vez
          const response = await api.get("/faturamensal/app/leituras");
          
          if (response.data && response.data.success) {
            const { data, timestamp } = response.data;
            
            // Salvar no AsyncStorage para uso offline
            await AsyncStorage.setItem('leituras_data', JSON.stringify(data));
            await AsyncStorage.setItem('leituras_timestamp', timestamp);
            
            setLeituras(data);
            setLastSyncTime(timestamp);
            setHasMore(false); // Tudo carregado de uma vez
            
            Toast.show({
              type: 'success',
              text1: 'Dados atualizados',
              text2: 'Leituras sincronizadas com sucesso',
              visibilityTime: 2000,
            });
          } else {
            // Fallback para API original (com paginação) em caso de erro
            console.log("Usando API com paginação como fallback");
            const fallbackResponse = await api.get("/faturamensal", {
              params: {
                page,
                limit: 10, // Aumentado para carregar mais de uma vez
              },
            });
            
            if (fallbackResponse.data && fallbackResponse.data.data) {
              const { data, hasMore: morePages } = fallbackResponse.data;
              
              // Processar os dados da mesma forma que antes
              const processedData = data.map((grupo: any) => {
                const leiturasInformadas = grupo.faturas?.filter(
                  (f: Fatura) => f.Leitura?.leitura && f.Leitura.leitura > 0
                ).length || 0;
                
                return {
                  ...grupo,
                  leiturasInformadas,
                  isAllFechada: grupo.faturas?.every((f: Fatura) => f.fechada === "Sim") || false,
                };
              });
              
              setLeituras(processedData);
              setHasMore(morePages);
              setCurrentPage(page);
            }
          }
        } catch (error) {
          console.error("Erro na API, tentando usar dados offline:", error);
          await carregarDadosOffline();
        }
      } else {
        // MODO OFFLINE: Carregar do AsyncStorage
        await carregarDadosOffline();
      }
    } catch (error) {
      console.error("Erro ao carregar leituras:", error);
      setError("Falha ao carregar as leituras. Verifique sua conexão.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      carregarLeituras(currentPage + 1);
    }
  }, [loading, hasMore, currentPage, carregarLeituras]);

  useEffect(() => {
    carregarLeituras(1);
    
    // Verificar conexão periódicamente
    const intervalId = setInterval(async () => {
      await checkConnection();
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarLeituras(1);
  };

  const handleCardPress = (leitura: LeituraMensal) => {
    setFaturasSelecionadas(leitura.faturas);
    setMesAnoSelecionado(leitura.mesAno);
    router.push("/LeiturasDetalhes");
  };

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#2a9d8f" />
        ) : (
          <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
            <Text style={styles.loadMoreText}>Carregar mais</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Indicador de modo offline */}
      {isOffline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline" size={18} color="#fff" />
          <Text style={styles.offlineText}>Modo offline</Text>
        </View>
      )}
      
      {/* Mensagem de erro, caso exista */}
      {error ? <ErrorMessage error={error} visible={!!error} /> : null}

      {/* Conteúdo principal */}
      {loading && !refreshing && leituras.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a9d8f" />
          <Text style={styles.loadingText}>Carregando leituras...</Text>
        </View>
      ) : (
        <FlatList
          data={leituras}
          keyExtractor={(item) => item.mesAno}
          renderItem={({ item }) => (
            <LeituraCard
              mesAno={item.mesAno}
              leiturasInformadas={item.leiturasInformadas}
              totalLeituras={item.totalLeituras}
              volumeTotal={item.volumeTotal}
              dataCriacao={item.dataCriacao}
              faturas={item.faturas}
              onPress={() => handleCardPress(item)}
              isAllFechada={item.isAllFechada}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2a9d8f"]}
            />
          }
          ListFooterComponent={
            <>
              {renderFooter()}
              {lastSyncTime && (
                <View style={styles.syncInfo}>
                  <Text style={styles.syncText}>
                    Última sincronização: {new Date(lastSyncTime).toLocaleString()}
                  </Text>
                </View>
              )}
            </>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma leitura encontrada</Text>
              <TouchableOpacity
                style={styles.reloadButton}
                onPress={() => carregarLeituras(1)}
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
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginBottom: 16,
  },
  reloadButton: {
    backgroundColor: "#2a9d8f",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 5,
  },
  reloadButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  footerContainer: {
    padding: 16,
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "#2a9d8f",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  loadMoreText: {
    color: "white",
    fontWeight: "bold",
  },
  offlineBar: {
    backgroundColor: '#ff6b6b',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  syncInfo: {
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  syncText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default LeiturasScreen;