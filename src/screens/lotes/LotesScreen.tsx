// src/screens/lotes/LotesScreen.tsx
import React, { useState, useEffect } from "react";
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
  const carregarDadosOffline = async () => {
    try {
      const lotesData = await AsyncStorage.getItem("lotes_data");
      const culturasData = await AsyncStorage.getItem("culturas_data");
      const timestamp = await AsyncStorage.getItem("lotes_timestamp");

      if (lotesData) {
        const lotesParsed = JSON.parse(lotesData);

        // Garantir que todos os lotes tenham os campos obrigatórios
        const lotesCompletos = lotesParsed.map((lote: any) => ({
          ...lote,
          areaLote: lote.areaLote || 0,
          sobraarea: lote.sobraarea || 0,
          categoria: lote.categoria || "Colono",
          situacao: lote.situacao || "Operacional",
          isPendingSync: pendingLotes[lote.id] || false,
        }));

        setLotes(lotesCompletos);
      } else {
        setError("Nenhum dado de lotes disponível offline");
      }

      if (culturasData) {
        setCulturas(JSON.parse(culturasData));
      }

      Toast.show({
        type: "info",
        text1: "Modo offline",
        text2: timestamp
          ? `Usando dados salvos em ${new Date(timestamp).toLocaleString()}`
          : "Usando dados salvos localmente",
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error("Erro ao carregar dados offline:", error);
      setError("Falha ao carregar dados offline");
    }
  };

  // Função principal para carregar lotes e culturas
  const carregarDados = async () => {
    try {
      setLoading(true);
      setError("");

      // Verificar se está offline
      const netInfo = await NetInfo.fetch();
      const isConnected = netInfo.isConnected;

      if (isConnected) {
        // MODO ONLINE: Buscar da API
        try {
          // Carregar lotes
          const lotesResponse = await api.get("/lotesagricolas");

          // Garantir que todos os lotes tenham valores para campos obrigatórios
          const lotesCompletos = lotesResponse.data.map((lote: any) => ({
            ...lote,
            areaLote: lote.areaLote || 0,
            sobraarea: lote.sobraarea || 0,
            categoria: lote.categoria || "Colono",
            situacao: lote.situacao || "Operacional",
            // Marcar lotes com sincronização pendente
            isPendingSync: pendingLotes[lote.id] || false,
          }));

          setLotes(lotesCompletos);

          // Carregar culturas
          const culturasResponse = await api.get("/culturas");
          setCulturas(culturasResponse.data);

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
        } catch (error) {
          console.error("Erro ao buscar dados da API:", error);

          // Tentar carregar dados do AsyncStorage como fallback
          await carregarDadosOffline();

          Toast.show({
            type: "error",
            text1: "Erro ao carregar dados do servidor",
            text2: "Usando dados offline como fallback",
            visibilityTime: 3000,
          });
        }
      } else {
        // MODO OFFLINE: Carregar dados do AsyncStorage
        await carregarDadosOffline();
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Falha ao carregar os dados. Verifique sua conexão.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Carregar dados ao iniciar o componente
  useEffect(() => {
    carregarDados();
  }, []);

  // Função para atualizar dados (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
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

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2a9d8f" />
          <Text style={styles.loadingText}>Carregando lotes...</Text>
        </View>
      ) : (
        <FlatList
          data={lotes}
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
              <Text style={styles.emptyText}>Nenhum lote encontrado</Text>
              <TouchableOpacity
                style={styles.reloadButton}
                onPress={carregarDados}
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
});

export default LotesScreen;
