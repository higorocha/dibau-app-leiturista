// src/screens/leituras/LeiturasScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import axios from 'axios';
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
  const [sincronizandoEmBackground, setSincronizandoEmBackground] = useState(false);


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

  // Função para verificar se deve sincronizar baseado no timestamp
const deveAtualizar = useCallback(async () => {
  try {
    const ultimaSincronizacao = await AsyncStorage.getItem('leituras_ultima_sincronizacao');
    
    if (!ultimaSincronizacao) {
      return true; // Nunca sincronizou antes
    }
    
    const ultimaData = new Date(ultimaSincronizacao).getTime();
    const agora = new Date().getTime();
    const duasHorasEmMS = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
    
    // Verifica se passaram pelo menos 2 horas desde a última sincronização
    return (agora - ultimaData) > duasHorasEmMS;
  } catch (error) {
    console.error("Erro ao verificar timestamp de sincronização:", error);
    return true; // Em caso de erro, sincroniza por precaução
  }
}, []);

// Função para salvar o timestamp da sincronização
const salvarTimestampSincronizacao = async () => {
  try {
    await AsyncStorage.setItem('leituras_ultima_sincronizacao', new Date().toISOString());
  } catch (error) {
    console.error("Erro ao salvar timestamp de sincronização:", error);
  }
};

const sincronizarDados = async () => {
  if (sincronizandoEmBackground) {
    console.log("[SYNC] Sincronização já em andamento, ignorando solicitação duplicada");
    return;
  }
  
  console.log("[SYNC] Iniciando sincronização em background");
  try {
    setSincronizandoEmBackground(true);
    
    // Verificar conexão antes de tentar sincronizar
    const netInfo = await NetInfo.fetch();
    console.log("[SYNC] Status da rede:", netInfo.isConnected ? "Conectado" : "Desconectado", 
                "Tipo:", netInfo.type);
    
    if (!netInfo.isConnected) {
      console.log("[SYNC] Sem conexão de rede, abortando sincronização");
      Toast.show({
        type: 'error',
        text1: 'Sem conexão',
        text2: 'Não foi possível sincronizar sem conexão com a internet',
        visibilityTime: 2000,
      });
      setSincronizandoEmBackground(false);
      return;
    }
    
    // Indicador discreto de sincronização
    Toast.show({
      type: 'info',
      text1: 'Sincronizando...',
      text2: 'Atualizando dados em segundo plano',
      visibilityTime: 2000,
    });
    
    console.log("[SYNC] Enviando requisição para /faturamensal/app/leituras");
    
    // Adicionar timeout mais longo para ambientes com conexão instável
    const response = await api.get("/faturamensal/app/leituras", {
      timeout: 30000, // 30 segundos
    });
    
    console.log("[SYNC] Resposta recebida, status:", response.status);
    
    if (response.data && response.data.success) {
      console.log("[SYNC] Dados recebidos com sucesso");
      const { data, timestamp } = response.data;
      
      // Garantir que data é do tipo esperado
      const leiturasMensais = data as LeituraMensal[];
      
      // Log do tamanho dos dados recebidos
      console.log("[SYNC] Tamanho dos dados recebidos:", 
                  leiturasMensais ? leiturasMensais.length : 0, "leituras,", 
                  JSON.stringify(leiturasMensais).length, "bytes");
      
      // --- ARMAZENAMENTO FRAGMENTADO ---
      try {
        // 1. Salvar índice dos meses disponíveis
        const mesesDisponiveis = leiturasMensais.map(mes => mes.mesAno);
        await AsyncStorage.setItem('leituras_meses_index', JSON.stringify(mesesDisponiveis));
        console.log(`[SYNC] Salvo índice de ${mesesDisponiveis.length} meses`);
        
        // 2. Salvar cada mês separadamente
        for (let i = 0; i < leiturasMensais.length; i++) {
          const mes = leiturasMensais[i];
          const chave = `leituras_mes_${mes.mesAno.replace("/", "_")}`;
          await AsyncStorage.setItem(chave, JSON.stringify(mes));
          console.log(`[SYNC] Salvos dados do mês ${mes.mesAno}`);
        }
        
        // 3. Salvar timestamp
        await AsyncStorage.setItem('leituras_timestamp', timestamp);
        console.log("[SYNC] Dados salvos no AsyncStorage (fragmentados)");
        
        // Atualizar estado da interface
        setLeituras(leiturasMensais);
        setLastSyncTime(timestamp);
        setHasMore(false);
        
        // Salvar timestamp da sincronização
        await salvarTimestampSincronizacao();
        console.log("[SYNC] Timestamp de sincronização atualizado");
        
        Toast.show({
          type: 'success',
          text1: 'Dados atualizados',
          text2: 'Leituras sincronizadas com sucesso',
          visibilityTime: 2000,
        });
      } catch (storageError) {
        console.error("[SYNC] Erro ao salvar no AsyncStorage:", storageError);
        // Mesmo com erro de armazenamento, atualizar a interface com os dados recebidos
        setLeituras(leiturasMensais);
        setLastSyncTime(timestamp);
        setHasMore(false);
        
        Toast.show({
          type: 'warning',
          text1: 'Dados atualizados parcialmente',
          text2: 'Houve um problema ao salvar dados para uso offline',
          visibilityTime: 3000,
        });
      }
    } else {
      console.log("[SYNC] A resposta não contém dados válidos:", JSON.stringify(response.data));
      Toast.show({
        type: 'error',
        text1: 'Erro de sincronização',
        text2: 'Formato de dados inválido recebido do servidor',
        visibilityTime: 3000,
      });
    }
  } catch (error) {
    // Log detalhado do erro com verificação de tipo segura
    console.error("[SYNC] Erro ao sincronizar dados:", error);
    
    // Verificar se é um erro do Axios
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // A requisição foi feita e o servidor respondeu com status diferente de 2xx
        console.error("[SYNC] Erro de resposta do servidor:", 
                      "Status:", error.response.status,
                      "Dados:", JSON.stringify(error.response.data));
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta (timeout ou problema de rede)
        console.error("[SYNC] Sem resposta do servidor (timeout ou problema de rede)");
      } else {
        // Erro ao configurar a requisição
        console.error("[SYNC] Erro ao configurar requisição:", error.message);
      }
    } else {
      // Outro tipo de erro
      console.error("[SYNC] Erro não relacionado ao Axios:", typeof error, error);
    }
    
    // Mostrar toast discreto de erro
    Toast.show({
      type: 'error',
      text1: 'Erro na sincronização',
      text2: 'Não foi possível conectar ao servidor',
      visibilityTime: 3000,
    });
  } finally {
    console.log("[SYNC] Sincronização finalizada");
    setSincronizandoEmBackground(false);
  }
};

// Nova função para carregar apenas dados locais
const carregarDadosLocais = async () => {
  try {
    // Verificar se temos o índice de meses
    const mesesIndexStr = await AsyncStorage.getItem('leituras_meses_index');
    const timestamp = await AsyncStorage.getItem('leituras_timestamp');
    
    if (mesesIndexStr) {
      const mesesIndex = JSON.parse(mesesIndexStr) as string[];
      console.log(`[OFFLINE] Encontrados ${mesesIndex.length} meses salvos localmente`);
      
      // Carregar dados de cada mês
      const dadosCompletos: LeituraMensal[] = [];
      
      for (const mesAno of mesesIndex) {
        const chave = `leituras_mes_${mesAno.replace("/", "_")}`;
        const mesDataStr = await AsyncStorage.getItem(chave);
        
        if (mesDataStr) {
          try {
            const mesData = JSON.parse(mesDataStr) as LeituraMensal;
            dadosCompletos.push(mesData);
          } catch (jsonError) {
            console.error(`[OFFLINE] Erro ao parsear dados do mês ${mesAno}:`, jsonError);
          }
        }
      }
      
      // Ordenar por data (mais recente primeiro)
      dadosCompletos.sort((a, b) => {
        const [mesA, anoA] = a.mesAno.split('/').map(Number);
        const [mesB, anoB] = b.mesAno.split('/').map(Number);
        
        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
      });
      
      if (dadosCompletos.length > 0) {
        setLeituras(dadosCompletos);
        setLastSyncTime(timestamp);
        setHasMore(false);
        
        // Só mostrar toast se estiver offline
        if (isOffline) {
          Toast.show({
            type: 'info',
            text1: 'Modo offline',
            text2: `Usando dados salvos em ${new Date(timestamp || '').toLocaleString()}`,
            visibilityTime: 3000,
          });
        }
        
        return true;
      }
    }
    
    // Se chegou aqui, não encontrou dados válidos
    return false;
  } catch (error) {
    console.error("Erro ao carregar dados offline:", error);
    return false;
  }
};

// Função para limpar cache antigo (chamada uma vez após migração)
const limparCacheAntigo = async () => {
  try {
    await AsyncStorage.removeItem('leituras_data');
    console.log("[STORAGE] Cache antigo removido com sucesso");
  } catch (error) {
    console.error("[STORAGE] Erro ao remover cache antigo:", error);
  }
};

const carregarLeituras = useCallback(async (param?: boolean | number) => {
  try {
    // Determinar se é uma página ou flag para forçar sincronização
    const forcarSincronizacao = typeof param === 'boolean' ? param : false;
    const page = typeof param === 'number' ? param : 1;
    
    // Se não estiver refreshing, mostre o loading apenas se não houver dados
    if (!refreshing && leituras.length === 0) {
      setLoading(true);
    }
    
    setError("");

    // Primeiro, carregamos dados locais para exibição rápida
    await carregarDadosLocais();
    
    // Verificar conexão
    const isConnected = await checkConnection();
    
    // Verificar se devemos sincronizar
    const deveSincronizar = forcarSincronizacao || await deveAtualizar();
    
    // Se está online e deve sincronizar, fazemos em background
    if (isConnected && deveSincronizar) {
      sincronizarDados();
    }
    
    // Atualizar currentPage se uma página foi especificada
    if (typeof param === 'number') {
      setCurrentPage(page);
    }
  } catch (error) {
    console.error("Erro ao carregar leituras:", error);
    setError("Falha ao carregar as leituras. Verifique sua conexão.");
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [leituras.length, refreshing, deveAtualizar]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      carregarLeituras(currentPage + 1);
    }
  }, [loading, hasMore, currentPage, carregarLeituras]);

  useEffect(() => {
    // Migrar para o novo formato de armazenamento (uma vez só)
    const verificarMigracao = async () => {
      const jaFezMigracao = await AsyncStorage.getItem('leituras_migracao_realizada');
      if (!jaFezMigracao) {
        console.log("[STORAGE] Iniciando migração de formato de armazenamento");
        await limparCacheAntigo();
        await AsyncStorage.setItem('leituras_migracao_realizada', 'true');
      }
    };
    
    verificarMigracao();
    carregarLeituras();
    
    // Verificar conexão periodicamente
    const intervalId = setInterval(async () => {
      await checkConnection();
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarLeituras(true); // Parâmetro true força sincronização
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