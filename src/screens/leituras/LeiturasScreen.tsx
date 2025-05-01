// src/screens/leituras/LeiturasScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import ImagemLeituraService from "@/src/services/ImagemLeituraService";

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
  const [sincronizandoEmBackground, setSincronizandoEmBackground] =
    useState(false);

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
      const dadosSalvos = await AsyncStorage.getItem("leituras_data");
      const timestamp = await AsyncStorage.getItem("leituras_timestamp");

      if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        setLeituras(dados);
        setLastSyncTime(timestamp);
        setHasMore(false);

        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: `Usando dados salvos em ${new Date(
            timestamp || ""
          ).toLocaleString()}`,
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

  const limparImagensFaturasFechadas = async (leituras: LeituraMensal[]) => {
    try {
      let totalRemovidas = 0;
      
      // Verificar cada mês de leituras
      for (const leitura of leituras) {
        if (leitura.isAllFechada) {
          const removidas = await ImagemLeituraService.limparImagensFaturasFechadas(
            leitura.mesAno, 
            leitura.isAllFechada, 
            leitura.faturas
          );
          
          totalRemovidas += removidas;
        }
      }
      
      if (totalRemovidas > 0) {
        console.log(`[LEITURAS] ${totalRemovidas} imagens de leituras removidas do armazenamento local`);
      }
    } catch (error) {
      console.error('[LEITURAS] Erro ao limpar imagens locais:', error);
    }
  };

  // Função para verificar se deve sincronizar baseado no timestamp
  const deveAtualizar = useCallback(async () => {
    try {
      // Verificar timestamp da última sincronização
      const ultimaSincronizacao = await AsyncStorage.getItem("leituras_ultima_sincronizacao");
      
      if (!ultimaSincronizacao) {
        console.log("[DEBUG] Nenhuma sincronização anterior encontrada, deve sincronizar");
        return true; // Nunca sincronizou antes
      }
      
      // Garantir que estamos lidando com timestamps UTC
      const ultimaData = new Date(ultimaSincronizacao).getTime();
      const agora = new Date().getTime();
      const duasHorasEmMS = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
      const diferenca = agora - ultimaData;
      
      // Verifica se passaram pelo menos 2 horas desde a última sincronização
      const deveSincronizar = diferenca > duasHorasEmMS;
      
      // Logs detalhados para debugging
      console.log(`[DEBUG] Timestamp da última sincronização: ${ultimaSincronizacao}`);
      console.log(`[DEBUG] Última sincronização: ${new Date(ultimaData).toLocaleString()}`);
      console.log(`[DEBUG] Horário atual: ${new Date(agora).toLocaleString()}`);
      console.log(`[DEBUG] Diferença em minutos: ${Math.floor(diferenca / 60000)}`);
      console.log(`[DEBUG] Deve sincronizar (passou 2h): ${deveSincronizar}`);
      
      return deveSincronizar;
    } catch (error) {
      console.error("[DEBUG] Erro ao verificar timestamp de sincronização:", error);
      return true; // Em caso de erro, sincroniza por precaução
    }
  }, []);

  // Função para salvar o timestamp da sincronização
  const salvarTimestampSincronizacao = async () => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG] Salvando timestamp de sincronização: ${timestamp}`);
      await AsyncStorage.setItem("leituras_ultima_sincronizacao", timestamp);
    } catch (error) {
      console.error("[DEBUG] Erro ao salvar timestamp de sincronização:", error);
    }
  };

  const sincronizarDados = async () => {
    // Evita múltiplas sincronizações simultâneas
    if (sincronizandoEmBackground) {
      console.log(
        "[DEBUG] Sincronização já em andamento, ignorando solicitação duplicada"
      );
      return;
    }
  
    console.log("[DEBUG] sincronizarDados iniciado");
    try {
      setSincronizandoEmBackground(true);
  
      // Verificar conexão antes de tentar sincronizar
      const netInfo = await NetInfo.fetch();
      console.log(
        "[DEBUG] Status da rede:",
        netInfo.isConnected ? "Conectado" : "Desconectado"
      );
  
      if (!netInfo.isConnected) {
        console.log("[DEBUG] Sem conexão de rede, abortando sincronização");
        Toast.show({
          type: "error",
          text1: "Sem conexão",
          text2: "Não foi possível sincronizar sem conexão com a internet",
          visibilityTime: 2000,
        });
        return;
      }
  
      // Indicador discreto de sincronização
      Toast.show({
        type: "info",
        text1: "Sincronizando Leituras...",
        text2: "Atualizando dados de leituras em segundo plano",
        visibilityTime: 2000,
      });
  
      console.log(
        "[DEBUG] Enviando requisição para /faturamensal/app/leituras"
      );
  
      try {
        // Requisição com timeout maior
        const response = await api.get("/faturamensal/app/leituras", {
          timeout: 30000, // 30 segundos
        });
  
        console.log("[DEBUG] Resposta recebida, status:", response.status);
  
        if (response.data && response.data.success) {
          console.log("[DEBUG] Dados recebidos com sucesso");
          const { data, timestamp } = response.data;
  
          // Garantir que data é do tipo esperado
          const leiturasMensais = data as LeituraMensal[];
  
          if (!leiturasMensais || leiturasMensais.length === 0) {
            console.log("[DEBUG] Lista de leituras vazia na resposta");
            Toast.show({
              type: "warning",
              text1: "Sem leituras disponíveis",
              text2: "Nenhuma leitura disponível no momento",
              visibilityTime: 3000,
            });
            return;
          }
  
          // Log do tamanho dos dados
          console.log(
            `[DEBUG] Recebidas ${leiturasMensais.length} leituras, ${
              JSON.stringify(leiturasMensais).length
            } bytes`
          );
  
          // ARMAZENAMENTO FRAGMENTADO
          try {
            // 1. Salvar índice dos meses
            const mesesDisponiveis = leiturasMensais.map((mes) => mes.mesAno);
            await AsyncStorage.setItem(
              "leituras_meses_index",
              JSON.stringify(mesesDisponiveis)
            );
            console.log(
              `[DEBUG] Índice de ${mesesDisponiveis.length} meses salvo`
            );
  
            // 2. Salvar cada mês separadamente
            for (let i = 0; i < leiturasMensais.length; i++) {
              const mes = leiturasMensais[i];
              const chave = `leituras_mes_${mes.mesAno.replace("/", "_")}`;
              await AsyncStorage.setItem(chave, JSON.stringify(mes));
              console.log(`[DEBUG] Dados do mês ${mes.mesAno} salvos`);
            }
  
            // 3. Salvar timestamp
            await AsyncStorage.setItem("leituras_timestamp", timestamp);
            console.log("[DEBUG] Dados fragmentados salvos com sucesso");
  
            // Atualizar interface
            setLeituras(leiturasMensais);
            setLastSyncTime(timestamp);
            setHasMore(false);
  
            // Salvar timestamp de sincronização
            await salvarTimestampSincronizacao();
  
            Toast.show({
              type: "success",
              text1: "Leituras atualizadas",
              text2: "Dados de leituras sincronizados com sucesso",
              visibilityTime: 2000,
            });
          } catch (storageError) {
            console.error(
              "[DEBUG] Erro ao salvar no AsyncStorage:",
              storageError
            );
  
            // Mesmo com erro, atualiza interface
            setLeituras(leiturasMensais);
            setLastSyncTime(timestamp);
            setHasMore(false);
            limparImagensFaturasFechadas(leiturasMensais);
          }
        } else {
          console.log("[DEBUG] Resposta sem dados válidos");
          Toast.show({
            type: "error",
            text1: "Formato inválido",
            text2: "Os dados recebidos estão em formato inválido",
            visibilityTime: 3000,
          });
        }
      } catch (apiError) {
        console.error("[DEBUG] Erro na chamada de API:", apiError);
        Toast.show({
          type: "error",
          text1: "Erro no servidor",
          text2: "Não foi possível obter dados do servidor",
          visibilityTime: 3000,
        });
      }
    } catch (error) {
      console.error("[DEBUG] Erro geral na sincronização:", error);
    } finally {
      console.log("[DEBUG] sincronizarDados finalizado");
      setSincronizandoEmBackground(false);
    }
  };

  // Nova função para carregar apenas dados locais
  const carregarDadosLocais = async () => {
    try {
      console.log("[DEBUG] carregarDadosLocais iniciado");

      // Verificar se temos o índice de meses
      const mesesIndexStr = await AsyncStorage.getItem("leituras_meses_index");
      const timestamp = await AsyncStorage.getItem("leituras_timestamp");

      // Se não temos índice de meses, não temos dados locais
      if (!mesesIndexStr) {
        console.log("[DEBUG] Nenhum índice de meses encontrado");
        return false;
      }

      console.log("[DEBUG] Índice de meses encontrado, processando...");
      const mesesIndex = JSON.parse(mesesIndexStr) as string[];
      console.log(
        `[DEBUG] Encontrados ${mesesIndex.length} meses salvos localmente`
      );

      // Carregar dados de cada mês
      const dadosCompletos: LeituraMensal[] = [];
      let dadosCarregados = false;

      for (const mesAno of mesesIndex) {
        const chave = `leituras_mes_${mesAno.replace("/", "_")}`;
        console.log(`[DEBUG] Tentando carregar mês ${mesAno}`);

        const mesDataStr = await AsyncStorage.getItem(chave);

        if (mesDataStr) {
          try {
            const mesData = JSON.parse(mesDataStr) as LeituraMensal;
            dadosCompletos.push(mesData);
            dadosCarregados = true;
            console.log(`[DEBUG] Mês ${mesAno} carregado com sucesso`);
          } catch (jsonError) {
            console.error(
              `[DEBUG] Erro ao parsear dados do mês ${mesAno}:`,
              jsonError
            );
          }
        } else {
          console.log(`[DEBUG] Não encontrado dados para o mês ${mesAno}`);
        }
      }

      // Se não carregamos nenhum dado, retornar falso
      if (!dadosCarregados || dadosCompletos.length === 0) {
        console.log("[DEBUG] Nenhum dado mensal foi carregado");
        return false;
      }

      // Ordenar por data (mais recente primeiro)
      dadosCompletos.sort((a, b) => {
        const [mesA, anoA] = a.mesAno.split("/").map(Number);
        const [mesB, anoB] = b.mesAno.split("/").map(Number);

        if (anoA !== anoB) return anoB - anoA;
        return mesB - mesA;
      });

      console.log(
        `[DEBUG] ${dadosCompletos.length} meses ordenados, atualizando estado`
      );
      setLeituras(dadosCompletos);
      setLastSyncTime(timestamp);
      setHasMore(false);

      // Só mostrar toast se estiver offline
      if (isOffline) {
        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: `Usando dados salvos em ${new Date(
            timestamp || ""
          ).toLocaleString()}`,
          visibilityTime: 3000,
        });
      }

      return true;
    } catch (error) {
      console.error("[DEBUG] Erro ao carregar dados offline:", error);
      return false;
    }
  };

  // Função para limpar cache antigo (chamada uma vez após migração)
  const limparCacheAntigo = async () => {
    try {
      await AsyncStorage.removeItem("leituras_data");
      console.log("[STORAGE] Cache antigo removido com sucesso");
    } catch (error) {
      console.error("[STORAGE] Erro ao remover cache antigo:", error);
    }
  };

  const carregarLeituras = useCallback(async (param?: boolean | number) => {
    const forcarSincronizacao = typeof param === 'boolean' ? param : false;
    const page = typeof param === 'number' ? param : 1;
    
    // Log para debugging
    console.log(`[DEBUG] carregarLeituras iniciado - forçar: ${forcarSincronizacao}, página: ${page}`);
    
    try {
      // Só mostrar loading se não estiver refreshing e for a primeira página ou lista vazia
      if (!refreshing && (page === 1 || leituras.length === 0)) {
        setLoading(true);
      }
      
      setError("");
  
      // Primeiro, carregamos dados locais (apenas na primeira página)
      let dadosLocaisEncontrados = false;
      if (page === 1) {
        console.log('[DEBUG] Tentando carregar dados locais');
        dadosLocaisEncontrados = await carregarDadosLocais();
        console.log(`[DEBUG] Dados locais encontrados: ${dadosLocaisEncontrados}`);
      }
      
      // Verificar conexão
      const isConnected = await checkConnection();
      console.log(`[DEBUG] Dispositivo conectado: ${isConnected}`);
      
      // Verificar se devemos sincronizar (apenas se for primeira página ou forçado)
      let deveSincronizar = false;
      if (page === 1 || forcarSincronizacao) {
        // Apenas forçar a sincronização se o usuário explicitamente pediu (pull-to-refresh)
        // ou se já passou o tempo mínimo desde a última sincronização
        if (forcarSincronizacao) {
          deveSincronizar = true;
          console.log("[DEBUG] Sincronização forçada pelo usuário");
        } else {
          deveSincronizar = await deveAtualizar();
          console.log(`[DEBUG] Sincronização automática: ${deveSincronizar ? "necessária" : "não necessária"}`);
        }
        console.log(`[DEBUG] Deve sincronizar: ${deveSincronizar}`);
      }
      
      // Se está online, primeira página ou forçado, e deve sincronizar, fazemos a sincronização
      if (isConnected && deveSincronizar && (page === 1 || forcarSincronizacao)) {
        console.log('[DEBUG] Iniciando sincronização');
        await sincronizarDados();
      } else if (page > 1 && leituras.length === 0) {
        // Se estamos tentando carregar mais páginas mas não temos dados, desabilitar paginação
        console.log('[DEBUG] Lista vazia e tentando carregar mais páginas, desabilitando paginação');
        setHasMore(false);
      } else {
        console.log('[DEBUG] Não vai sincronizar');
      }
      
      // Atualizar currentPage apenas se houver dados e for carregamento de página adicional
      if (typeof param === 'number' && leituras.length > 0) {
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("[DEBUG] Erro ao carregar leituras:", error);
      setError("Falha ao carregar as leituras. Verifique sua conexão.");
    } finally {
      console.log('[DEBUG] carregarLeituras finalizado, definindo loading e refreshing como false');
      setLoading(false);
      setRefreshing(false);
    }
  }, [leituras.length, refreshing, deveAtualizar, sincronizarDados]);

  const loadMore = useCallback(() => {
    // Adicionado para debugging
    console.log(
      "[DEBUG] loadMore chamado - hasMore:",
      hasMore,
      "loading:",
      loading,
      "leituras:",
      leituras.length
    );

    // *** CORREÇÃO PRINCIPAL: Não carregue mais se a lista estiver vazia ***
    if (!loading && hasMore && leituras.length > 0) {
      carregarLeituras(currentPage + 1);
    } else if (leituras.length === 0) {
      // Se a lista estiver vazia, desabilitar carregamento adicional
      setHasMore(false);
    }
  }, [loading, hasMore, currentPage, carregarLeituras, leituras.length]);

  useEffect(() => {
    console.log("[DEBUG] useEffect principal iniciado");
    
    // Verificar migração e inicializar dados
    const inicializar = async () => {
      try {
        // Verificar migração de dados (uma vez só)
        const jaFezMigracao = await AsyncStorage.getItem('leituras_migracao_realizada');
        if (!jaFezMigracao) {
          console.log("[DEBUG] Realizando migração de dados");
          await limparCacheAntigo();
          await AsyncStorage.setItem('leituras_migracao_realizada', 'true');
        }
  
        // Importante: carregar dados locais primeiro
        await carregarDadosLocais();
        
        // Verificar se deve sincronizar baseado no timestamp
        const deveSincronizar = await deveAtualizar();
        console.log(`[DEBUG] Deve sincronizar na inicialização: ${deveSincronizar}`);
        
        // Só sincronizar se necessário (primeira vez ou após 2h)
        if (deveSincronizar) {
          console.log("[DEBUG] Iniciando sincronização inicial");
          await carregarLeituras(true); // Forçar sincronização
        } else {
          console.log("[DEBUG] Usando dados em cache (menos de 2h desde última sincronização)");
          // Garantir que loading e refreshing estejam desativados
          setLoading(false);
          setRefreshing(false);
        }
      } catch (error) {
        console.error('[DEBUG] Erro ao inicializar:', error);
        setLoading(false);
      }
    };
    
    // Inicializar o app
    inicializar();
    
    // Verificar conexão periodicamente
    const intervalId = setInterval(async () => {
      await checkConnection();
    }, 10000);
    
    console.log("[DEBUG] useEffect principal configurado");
    
    return () => {
      console.log("[DEBUG] useEffect principal sendo limpo");
      clearInterval(intervalId);
    };
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
  
  const EmptyListComponent = React.memo(() => {
    const handleRetry = useCallback(() => {
      // Forçar sincronização
      carregarLeituras(true);
    }, []);
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma leitura encontrada</Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleRetry}
        >
          <Text style={styles.reloadButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  });
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
          ListEmptyComponent={loading ? null : <EmptyListComponent />}
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
          onEndReached={leituras.length > 0 ? loadMore : undefined}
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
                    Última sincronização:{" "}
                    {new Date(lastSyncTime).toLocaleString()}
                  </Text>
                </View>
              )}
            </>
          }
          onEndReachedThreshold={0.5}
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
    backgroundColor: "#ff6b6b",
    padding: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  offlineText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
  },
  syncInfo: {
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  syncText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
});

export default LeiturasScreen;
