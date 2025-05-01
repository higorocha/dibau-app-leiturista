// src/screens/lotes/LotesScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Alert,
  TextInput,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/axiosConfig";
import { useAuth } from "../../contexts/AuthContext";
import ErrorMessage from "../../components/ErrorMessage";
import { useTheme } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import CulturasModal from "../../components/lotes/CulturasModal";
import { checkAndSyncCulturas } from "../../services/CulturasSyncService";
// Importar os tipos do arquivo compartilhado
import { Lote, Cultura, LoteCultura } from "../../types/models";

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

const LotesScreen: React.FC = () => {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [pendingLotes, setPendingLotes] = useState<{ [key: number]: boolean }>(
    {}
  );

  // Estado para modal de culturas
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [selectedLoteCulturas, setSelectedLoteCulturas] = useState<
    LoteCultura[]
  >([]);

  // Estados para busca e filtro
  const [searchText, setSearchText] = useState<string>("");
  const [filteredLotes, setFilteredLotes] = useState<Lote[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filtroCultura, setFiltroCultura] = useState<
    "todos" | "comCulturas" | "semCulturas"
  >("todos");

  // Estado para animação do painel de filtros
  const filterAnimation = useRef(new Animated.Value(0)).current;

  const { user } = useAuth();
  const { colors } = useTheme();

  // Verificar conexão e sincronizar quando online
  useEffect(() => {
    const checkConnectionAndSync = async () => {
      const netInfo = await NetInfo.fetch();
      setIsOffline(!netInfo.isConnected);

      // Se estiver online, verificar e sincronizar pendências
      if (netInfo.isConnected) {
        checkAndSyncCulturas();
      }
    };

    checkConnectionAndSync();

    // Monitorar mudanças de conectividade
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
      if (state.isConnected) {
        checkAndSyncCulturas();
      }
    });

    return () => unsubscribe();
  }, []);

  // Animação do painel de filtros
  useEffect(() => {
    Animated.timing(filterAnimation, {
      toValue: showFilters ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showFilters, filterAnimation]);

  const filterPanelHeight = filterAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  // Carregar lotes pendentes de sincronização do AsyncStorage
  useEffect(() => {
    const loadPendingUpdates = async () => {
      try {
        const pendingDataStr = await AsyncStorage.getItem(
          "pendingCulturasUpdates"
        );
        if (pendingDataStr) {
          const pendingData = JSON.parse(pendingDataStr);
          const pendingIds = Object.keys(pendingData).reduce((acc, key) => {
            acc[Number(key)] = true;
            return acc;
          }, {} as { [key: number]: boolean });

          setPendingLotes(pendingIds);
        }
      } catch (error) {
        console.error("Erro ao carregar lotes pendentes:", error);
      }
    };

    loadPendingUpdates();
  }, []);

  // Função para carregar dados do AsyncStorage quando offline
  // Função para carregar dados do AsyncStorage quando offline
  const carregarDadosOffline = async () => {
    try {
      // Log para debug
      console.log("[LOTES] Tentando carregar dados offline");

      const lotesData = await AsyncStorage.getItem("lotes_data");
      const culturasData = await AsyncStorage.getItem("culturas_data");
      const timestamp = await AsyncStorage.getItem("lotes_timestamp");

      if (!lotesData) {
        console.log("[LOTES] Nenhum dado disponível offline");
        return false;
      }

      const lotesParsed = JSON.parse(lotesData);

      // Garantir que todos os lotes tenham os campos obrigatórios
      const lotesCompletos = lotesParsed.map((lote: Lote) => ({
        ...lote,
        areaLote: lote.areaLote || 0,
        sobraarea: lote.sobraarea || 0,
        categoria: lote.categoria || "Colono",
        situacao: lote.situacao || "Operacional",
        isPendingSync: pendingLotes[lote.id] || false,
      }));

      // Atualizar estado com dados offline
      setLotes(lotesCompletos);
      setFilteredLotes(lotesCompletos);

      if (culturasData) {
        setCulturas(JSON.parse(culturasData));
      }

      // Só mostrar toast se estiver offline para não incomodar
      if (isOffline) {
        Toast.show({
          type: "info",
          text1: "Modo offline",
          text2: timestamp
            ? `Usando dados salvos em ${new Date(timestamp).toLocaleString()}`
            : "Usando dados salvos localmente",
          visibilityTime: 2000,
        });
      }

      return true;
    } catch (error) {
      console.error("[LOTES] Erro ao carregar dados offline:", error);
      return false;
    }
  };

  const deveAtualizar = useCallback(async () => {
    try {
      // Verificar timestamp da última sincronização
      const ultimaSincronizacao = await AsyncStorage.getItem(
        "lotes_ultima_sincronizacao" // ou "leituras_ultima_sincronizacao" para LeiturasScreen
      );
  
      if (!ultimaSincronizacao) {
        console.log("[DEBUG] Nenhuma sincronização anterior encontrada, deve sincronizar");
        return true; // Nunca sincronizou antes
      }
  
      const ultimaData = new Date(ultimaSincronizacao).getTime();
      const agora = new Date().getTime();
      const duasHorasEmMS = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
  
      // Verifica se passaram pelo menos 2 horas desde a última sincronização
      const deveSincronizar = agora - ultimaData > duasHorasEmMS;
      console.log(`[DEBUG] Última sincronização: ${new Date(ultimaData).toLocaleString()}`);
      console.log(`[DEBUG] Tempo decorrido: ${Math.floor((agora - ultimaData) / 60000)} minutos`);
      console.log(`[DEBUG] Deve sincronizar: ${deveSincronizar}`);
      
      return deveSincronizar;
    } catch (error) {
      console.error("Erro ao verificar timestamp de sincronização:", error);
      return true; // Em caso de erro, sincroniza por precaução
    }
  }, []);

  // Função para salvar o timestamp da sincronização
  const salvarTimestampSincronizacao = async () => {
    try {
      await AsyncStorage.setItem(
        "lotes_ultima_sincronizacao",
        new Date().toISOString()
      );
    } catch (error) {
      console.error("Erro ao salvar timestamp de sincronização:", error);
    }
  };

  // Função para aplicar filtro e busca aos lotes
  const aplicarFiltro = useCallback(
    (lotesArray: Lote[], termo: string, filtroCulturaAtual: "todos" | "comCulturas" | "semCulturas"): Lote[] => {
      // Aplicar filtro de texto (busca)
      let resultado = termo
        ? lotesArray.filter(
            (lote) =>
              lote.nomeLote.toLowerCase().includes(termo.toLowerCase()) ||
              (lote.Cliente?.nome && lote.Cliente.nome.toLowerCase().includes(termo.toLowerCase()))
          )
        : [...lotesArray];
  
      // Aplicar filtro de culturas
      if (filtroCulturaAtual === "comCulturas") {
        resultado = resultado.filter(
          (lote) => lote.Culturas && lote.Culturas.length > 0
        );
      } else if (filtroCulturaAtual === "semCulturas") {
        resultado = resultado.filter(
          (lote) => !lote.Culturas || lote.Culturas.length === 0
        );
      }
  
      return resultado;
    },
    []
  );

  // Efeito para atualizar a lista quando filtro ou busca mudam
  useEffect(() => {
    const filteredResults = aplicarFiltro(lotes, searchText, filtroCultura);
    setFilteredLotes(filteredResults);
  }, [lotes, searchText, filtroCultura, aplicarFiltro]);

  const sincronizarEmBackground = async (forcarSincronizacao = false): Promise<void> => {
    // Verificar se já está sincronizando para evitar requisições duplicadas
    if (loading) {
      console.log("[LOTES] Sincronização já em andamento");
      return;
    }
    
    try {
      // Verificar se há conexão
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log("[LOTES] Sem conexão, não é possível sincronizar");
        return;
      }
      
      // Verificar se deve sincronizar
      if (!forcarSincronizacao) {
        const deveSinc = await deveAtualizar();
        if (!deveSinc) {
          console.log("[LOTES] Sincronização ignorada, última sincronização recente");
          return;
        }
      }
      
      // Indicador discreto de sincronização
      Toast.show({
        type: "info",
        text1: "Sincronizando Lotes...",
        text2: "Atualizando dados de lotes em segundo plano",
        visibilityTime: 2000,
      });
      
      // Buscar dados da API
      const lotesResponse = await api.get("/lotesagricolas");
      const culturasResponse = await api.get("/culturas");
      
      // Garantir que todos os lotes tenham valores para campos obrigatórios
      const lotesCompletos = lotesResponse.data.map((lote: Lote) => ({
        ...lote,
        areaLote: lote.areaLote || 0,
        sobraarea: lote.sobraarea || 0,
        categoria: lote.categoria || "Colono",
        situacao: lote.situacao || "Operacional",
        // Marcar lotes com sincronização pendente
        isPendingSync: pendingLotes[lote.id] || false,
      }));
      
      // Salvar dados para uso offline
      await AsyncStorage.setItem(
        "lotes_data",
        JSON.stringify(lotesCompletos)
      );
      await AsyncStorage.setItem(
        "culturas_data",
        JSON.stringify(culturasResponse.data)
      );
      await AsyncStorage.setItem(
        "lotes_timestamp",
        new Date().toISOString()
      );
      
      // Atualizar estado - CORRIGIDO
      setLotes(lotesCompletos);
      // Aqui aplicamos o filtro e depois atualizamos o estado
      const lotesFiltered = aplicarFiltro(lotesCompletos, searchText, filtroCultura);
      setFilteredLotes(lotesFiltered);
      
      // Salvar timestamp da sincronização
      await salvarTimestampSincronizacao();
      
      Toast.show({
        type: "success",
        text1: "Lotes atualizados",
        text2: "Dados de lotes sincronizados com sucesso",
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error("[LOTES] Erro na sincronização em background:", error);
      
      // Se ocorrer erro, tentar carregar dados offline como fallback
      if (lotes.length === 0) {
        await carregarDadosOffline();
      }
    }
  };

  // Função principal para carregar lotes e culturas
  const carregarDados = async (forcarSincronizacao = false) => {
    console.log(`[LOTES] carregarDados - forçar: ${forcarSincronizacao}`);

    try {
      // Se for forçar sincronização ou não tiver dados, mostrar loading
      if ((forcarSincronizacao || lotes.length === 0) && !refreshing) {
        setLoading(true);
      }

      setError("");

      // 1. Primeiro, tentar carregar dados offline
      const dadosOfflineCarregados = await carregarDadosOffline();
      console.log(
        `[LOTES] Dados offline carregados: ${dadosOfflineCarregados}`
      );

      // 2. Verificar conexão
      const isConnected = await NetInfo.fetch();
      setIsOffline(!isConnected);

      // 3. Se estiver online, iniciar sincronização em background
      if (isConnected) {
        // Se forçar sincronização ou não tiver dados offline, sincronizar imediatamente
        if (forcarSincronizacao || !dadosOfflineCarregados) {
          console.log("[LOTES] Iniciando sincronização imediata");
          await sincronizarEmBackground(true);
        } else {
          // Verificar se deve sincronizar baseado no timestamp
          const deveSinc = await deveAtualizar();
          if (deveSinc) {
            console.log("[LOTES] Iniciando sincronização em background");
            // Timeout pequeno para não impactar carregamento inicial
            setTimeout(() => sincronizarEmBackground(), 500);
          } else {
            console.log(
              "[LOTES] Sincronização ignorada, última sincronização recente"
            );
          }
        }
      } else if (!dadosOfflineCarregados) {
        // Se está offline e não tem dados, mostrar erro
        setError(
          "Você está offline e não há dados salvos. Conecte-se à internet e tente novamente."
        );
      }
    } catch (err) {
      console.error("[LOTES] Erro ao carregar dados:", err);
      setError("Falha ao carregar os dados. Verifique sua conexão.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carregar dados ao iniciar o componente
  useEffect(() => {
    console.log("[LOTES] useEffect principal iniciado");

    // Carregar dados iniciais
    carregarDados();

    // Verificar conexão periodicamente e sincronizar alterações pendentes quando online
    const intervalId = setInterval(async () => {
      const netInfo = await NetInfo.fetch();
      const novoStatus = !netInfo.isConnected;

      // Se mudou de offline para online, verificar pendências
      if (isOffline && !novoStatus) {
        console.log("[LOTES] Dispositivo reconectado, verificando pendências");
        // Verificar novamente se deve sincronizar
        const deveSinc = await deveAtualizar();
        if (deveSinc) {
          sincronizarEmBackground();
        }

        // Tentar sincronizar culturas pendentes
        checkAndSyncCulturas();
      }

      setIsOffline(novoStatus);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Função para atualizar dados (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    setSearchText("");
    setFiltroCultura("todos");
    carregarDados();
  };

  // Função para abrir modal de culturas de um lote
  const handleLotePress = (lote: Lote) => {
    // Garantir que todos os campos obrigatórios tenham valores
    const loteCompleto: Lote = {
      ...lote,
      areaLote: lote.areaLote || 0,
      sobraarea: lote.sobraarea || 0,
      categoria: lote.categoria || "Colono",
      situacao: lote.situacao || "Operacional",
    };

    setSelectedLote(loteCompleto);

    // Preparar culturas para o modal - CORREÇÃO AQUI
    const lotesCulturas =
      lote.Culturas?.map((cultura) => {
        // Acessar os dados de área diretamente do objeto dentro da cultura
        return {
          culturaId: cultura.id,
          areaPlantada: cultura.LotesCulturas?.areaPlantada || 0,
          areaProduzindo: cultura.LotesCulturas?.areaProduzindo || 0,
        };
      }) || [];

    setSelectedLoteCulturas(lotesCulturas);
    setModalVisible(true);
  };

  // Função para renderizar o painel de filtros
  const renderFilterPanel = () => (
    <Animated.View
      style={[
        styles.filterPanel,
        {
          height: filterPanelHeight,
          opacity: filterAnimation,
          overflow: "hidden",
        },
      ]}
    >
      <View style={styles.filterPanelContent}>
        {/* Bloco de filtros por culturas */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterBlockTitle}>Culturas</Text>
          <View style={styles.filterButtonsRow}>
            <TouchableOpacity
              style={styles.reloadButton}
              onPress={() => carregarDados(true)}
            >
              <Text style={styles.reloadButtonText}>Tentar novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                filtroCultura === "comCulturas" && styles.filterChipActive,
              ]}
              onPress={() => setFiltroCultura("comCulturas")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroCultura === "comCulturas" &&
                    styles.filterChipTextActive,
                ]}
              >
                Com Culturas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterChip,
                filtroCultura === "semCulturas" && styles.filterChipActive,
              ]}
              onPress={() => setFiltroCultura("semCulturas")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtroCultura === "semCulturas" &&
                    styles.filterChipTextActive,
                ]}
              >
                Sem Culturas
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // Função para processar alterações de culturas feitas no modal
  const handleCulturasSave = async (
    culturasAtualizadas: LoteCultura[],
    deletedCultureIds: number[] = []
  ) => {
    if (!selectedLote) return;

    // Verificar se há alguma cultura pendente
    const hasPending = culturasAtualizadas.some((c) => c.isPending);

    // Atualizar a lista de lotes com as novas culturas
    const updatedLotes = lotes.map((lote) => {
      if (lote.id === selectedLote.id) {
        // Criar uma cópia do lote
        const updatedLote = { ...lote };

        // Atualizar Culturas e LotesCulturas
        if (updatedLote.Culturas) {
          // 1. Filtrar culturas excluídas
          updatedLote.Culturas = updatedLote.Culturas.filter(
            (cultura) => !deletedCultureIds.includes(cultura.id)
          );

          // 2. Atualizar áreas para culturas existentes
          updatedLote.Culturas = updatedLote.Culturas.map((cultura) => {
            const updatedCultura = culturasAtualizadas.find(
              (c) => c.culturaId === cultura.id
            );

            if (updatedCultura) {
              return {
                ...cultura,
                LotesCulturas: {
                  ...cultura.LotesCulturas,
                  areaPlantada: updatedCultura.areaPlantada,
                  areaProduzindo: updatedCultura.areaProduzindo,
                },
              };
            }
            return cultura;
          });

          // 3. Adicionar novas culturas (as que não existiam antes)
          const existingCultureIds = updatedLote.Culturas.map((c) => c.id);
          const newCultures = culturasAtualizadas.filter(
            (c) => !existingCultureIds.includes(c.culturaId) && c.isNew
          );

          if (newCultures.length > 0) {
            // Buscar detalhes completos dessas culturas no array allCulturas
            const newCompleteCultures = newCultures
              .map((newCulture) => {
                const culturaCompleta = culturas.find(
                  (c) => c.id === newCulture.culturaId
                );

                if (culturaCompleta) {
                  return {
                    ...culturaCompleta, // Todos os dados da cultura (id, descricao, etc)
                    LotesCulturas: {
                      areaPlantada: newCulture.areaPlantada,
                      areaProduzindo: newCulture.areaProduzindo,
                    },
                  };
                }
                return null;
              })
              .filter((c) => c !== null);

            // Adicionar as novas culturas completas ao array
            updatedLote.Culturas = [
              ...updatedLote.Culturas,
              ...newCompleteCultures,
            ];
          }
        }

        // Marcar lote como pendente de sincronização
        return {
          ...updatedLote,
          isPendingSync: hasPending || pendingLotes[lote.id],
        };
      }
      return lote;
    });

    setLotes(updatedLotes);
    setFilteredLotes(updatedLotes);

    // Atualizar dados no AsyncStorage para uso offline
    await AsyncStorage.setItem("lotes_data", JSON.stringify(updatedLotes));

    // Atualizar estado de lotes pendentes
    if (hasPending) {
      const newPendingLotes = { ...pendingLotes, [selectedLote.id]: true };
      setPendingLotes(newPendingLotes);
      await AsyncStorage.setItem(
        "pendingLotesStatus",
        JSON.stringify(newPendingLotes)
      );
    }
  };

  // Função para cor da categoria
  const getCategoriaColor = (categoria: string): string => {
    switch (categoria) {
      case "Colono":
        return "#2a9d8f";
      case "Tecnico":
        return "#e9c46a";
      case "Empresarial":
        return "#f4a261";
      case "Adjacente":
        return "#e76f51";
      default:
        return "#999999";
    }
  };

  const categoriaLabels: Record<string, string> = {
    Colono: "Colono",
    Tecnico: "Técnico",
    Empresarial: "Empresarial",
    Adjacente: "Adjacente",
  };

  // Renderização de item de lote
  const renderItem = ({ item }: { item: Lote }) => {
    // Verificar se item.Cliente existe
    const clienteNome = item.Cliente?.nome || "Cliente não informado";
    const rawCategoria = item.categoria || "Sem categoria";
    const categoria = categoriaLabels[rawCategoria] || rawCategoria;
    const isPending = item.isPendingSync;

    return (
      <TouchableOpacity
        style={[styles.card, isPending && styles.cardPending]}
        onPress={() => handleLotePress(item)}
      >
        {isPending && (
          <View style={styles.pendingBadge}>
            <Ionicons name="cloud-upload" size={14} color="#fff" />
            <Text style={styles.pendingText}>Pendente</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <Text style={styles.loteNome}>{item.nomeLote}</Text>
          <View
            style={[
              styles.categoriaBadge,
              { backgroundColor: getCategoriaColor(rawCategoria) },
            ]}
          >
            <Text style={styles.categoriaText}>{categoria}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.clienteNome}>Irrigante: {clienteNome}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Área Total:</Text>
            <Text style={styles.infoValue}>{item.areaTotal} ha</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Situação:</Text>
            <Text
              style={[
                styles.situacaoText,
                {
                  color:
                    item.situacao === "Operacional" ? "#2a9d8f" : "#e63946",
                },
              ]}
            >
              {item.situacao || "Não informada"}
            </Text>
          </View>

          {item.Culturas && item.Culturas.length > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Culturas:</Text>
              <Text style={styles.infoValue}>
                {item.Culturas.map((c) => c.descricao).join(", ")}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
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

      <ErrorMessage error={error} visible={!!error} />

      {/* Campo de busca com botão de filtro */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons
            name="search"
            size={22}
            color="#666"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por lote ou irrigante..."
            value={searchText}
            onChangeText={setSearchText}
            clearButtonMode="while-editing"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            showFilters && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name={showFilters ? "options" : "options-outline"}
            size={22}
            color={showFilters ? "#fff" : "#2a9d8f"}
          />
        </TouchableOpacity>
      </View>

      {/* Painel de filtros expansível */}
      {renderFilterPanel()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a9d8f" />
          <Text style={styles.loadingText}>Carregando lotes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLotes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
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
              <Text style={styles.emptyText}>
                {searchText || filtroCultura !== "todos" 
                  ? "Nenhum lote encontrado com os filtros atuais" 
                  : "Nenhum lote encontrado"}
              </Text>
              <TouchableOpacity
                style={styles.reloadButton}
                onPress={() => carregarDados(true)}
              >
                <Text style={styles.reloadButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de Culturas */}
      <CulturasModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        lote={selectedLote}
        culturas={culturas}
        lotesCulturas={selectedLoteCulturas}
        onSave={handleCulturasSave}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  // Estilo para cards pendentes de sincronização
  cardPending: {
    borderLeftWidth: 4,
    borderLeftColor: "#f39c12",
  },
  pendingBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#f39c12",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    zIndex: 1,
  },
  pendingText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: isTablet ? 30 : 16,
    paddingVertical: isTablet ? 20 : 16,
    backgroundColor: "#2a9d8f",
  },
  headerTitle: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: isTablet ? 16 : 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutText: {
    color: "white",
    fontWeight: "bold",
    fontSize: isTablet ? 16 : 14,
  },
  listContent: {
    padding: isTablet ? 24 : 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  loteNome: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
  },
  categoriaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoriaText: {
    color: "white",
    fontSize: isTablet ? 14 : 12,
    fontWeight: "bold",
  },
  cardBody: {
    padding: 16,
  },
  clienteNome: {
    fontSize: isTablet ? 18 : 16,
    marginBottom: 12,
    color: "#555",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    width: 100,
  },
  infoValue: {
    fontSize: isTablet ? 16 : 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
  },
  situacaoText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: isTablet ? 18 : 16,
    color: "#666",
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: isTablet ? 18 : 16,
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
    fontSize: isTablet ? 16 : 14,
  },
  // Estilos para busca e filtro
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a9d8f",
  },
  filterButtonActive: {
    backgroundColor: "#2a9d8f",
  },
  filterPanel: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 16,
  },
  filterPanelContent: {
    paddingVertical: 12,
  },
  filterBlock: {
    marginBottom: 8,
  },
  filterBlockTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
  },
  filterButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  filterChipActive: {
    backgroundColor: "#2a9d8f",
    borderColor: "#2a9d8f",
  },
  filterChipText: {
    color: "#666",
    fontWeight: "500",
    fontSize: 14,
  },
  filterChipTextActive: {
    color: "#fff",
  },
});

export default LotesScreen;
