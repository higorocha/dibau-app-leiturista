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
import { useLeiturasContext } from "../../contexts/LeiturasContext"; // Importando o contexto
import api from "../../api/axiosConfig";
import LeituraCard from "../../components/leituras/LeituraCard";
import ErrorMessage from "../../components/ErrorMessage";
import { useTheme } from "@react-navigation/native";

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
}

const LeiturasScreen: React.FC = () => {
  const [leituras, setLeituras] = useState<LeituraMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const { user } = useAuth();
  const { colors } = useTheme();

  // Usando o contexto para salvar as faturas selecionadas
  const { setFaturasSelecionadas, setMesAnoSelecionado } = useLeiturasContext();

  const carregarLeituras = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");

        console.log(`Iniciando carregamento de leituras (página ${page})...`);

        // Chamada à API com parâmetros de paginação
        const response = await api.get("/faturamensal", {
          params: {
            page,
            limit: 3,
          },
        });

        console.log("Resposta da API:", response.status);

        // Verificar se a resposta segue o formato esperado (data e hasMore)
        if (response.data && response.data.data) {
          const { data, hasMore: morePages } = response.data;
          console.log(
            `Recebidos ${data.length} grupos de faturas, hasMore: ${morePages}`
          );

          // Se for a primeira página, substituímos os dados
          // Se for uma página subsequente, concatenamos com os dados existentes
          const novasLeituras = page === 1 ? [] : [...leituras];

          // Processar cada grupo de faturas recebido
          data.forEach((grupo: any) => {
            // Calcular leituras informadas (com valor > 0)
            const leiturasInformadas =
              grupo.faturas?.filter(
                (f: Fatura) =>
                  f.valor_leitura_m3 &&
                  parseFloat(f.valor_leitura_m3.toString()) > 0
              ).length || 0;

            // Calcular valores totais
            let valorTotal = 0;
            let valorMonetario = 0;
            let valorParteFixa = 0;
            let volumeTotal = 0;

            if (grupo.faturas && grupo.faturas.length > 0) {
              grupo.faturas.forEach((fatura: Fatura) => {
                valorTotal += parseFloat(fatura.valor_total?.toString() || "0");
                valorMonetario += parseFloat(
                  fatura.valor_monetario?.toString() || "0"
                );
                valorParteFixa += parseFloat(
                  fatura.valor_parte_fixa?.toString() || "0"
                );
                volumeTotal += parseFloat(
                  fatura.valor_leitura_m3?.toString() || "0"
                );
              });
            }

            novasLeituras.push({
              mesAno: grupo.mesAno,
              quantidadeLeituras: grupo.faturas?.length || 0,
              valorTotal,
              valorMonetario,
              valorParteFixa,
              volumeTotal,
              dataCriacao: grupo.dataCriacao || new Date().toISOString(),
              leiturasInformadas,
              totalLeituras: grupo.faturas?.length || 0,
              faturas: grupo.faturas || [],
            });
          });

          setLeituras(novasLeituras);
          setHasMore(morePages);
          setCurrentPage(page);
          console.log(
            `Processadas ${novasLeituras.length} leituras mensais no total`
          );
        } else {
          console.log("Resposta completa:", JSON.stringify(response.data));
          console.log(
            "Formato de resposta inesperado. Verificando se é um array direto."
          );

          // Tentar tratar a resposta como um array direto
          if (Array.isArray(response.data)) {
            console.log(
              `Dados recebidos como array com ${response.data.length} itens`
            );
            const dataArray = response.data;

            // Processar os dados como antes
            const leiturasProcessadas = dataArray.map((grupo: any) => {
              const leiturasInformadas =
                grupo.faturas?.filter(
                  (f: Fatura) =>
                    f.valor_leitura_m3 &&
                    parseFloat(f.valor_leitura_m3.toString()) > 0
                ).length || 0;

              let valorTotal = 0;
              let valorMonetario = 0;
              let valorParteFixa = 0;
              let volumeTotal = 0;

              if (grupo.faturas && grupo.faturas.length > 0) {
                grupo.faturas.forEach((fatura: Fatura) => {
                  valorTotal += parseFloat(
                    fatura.valor_total?.toString() || "0"
                  );
                  valorMonetario += parseFloat(
                    fatura.valor_monetario?.toString() || "0"
                  );
                  valorParteFixa += parseFloat(
                    fatura.valor_parte_fixa?.toString() || "0"
                  );
                  volumeTotal += parseFloat(
                    fatura.valor_leitura_m3?.toString() || "0"
                  );
                });
              }

              return {
                mesAno: grupo.mesAno,
                quantidadeLeituras: grupo.faturas?.length || 0,
                valorTotal,
                valorMonetario,
                valorParteFixa,
                volumeTotal,
                dataCriacao: grupo.dataCriacao || new Date().toISOString(),
                leiturasInformadas,
                totalLeituras: grupo.faturas?.length || 0,
                faturas: grupo.faturas || [],
              };
            });

            setLeituras(leiturasProcessadas);
            setHasMore(false); // Não sabemos se há mais, então assumimos que não
            console.log(
              `Processadas ${leiturasProcessadas.length} leituras mensais (array direto)`
            );
          } else {
            // Se não conseguirmos tratar, mostramos uma tela vazia
            console.log(
              "Nenhum dado de leitura encontrado ou formato completamente inesperado"
            );
            setLeituras([]);
          }
        }
      } catch (err: any) {
        console.error("Erro ao carregar leituras:", err);
        setError("Falha ao carregar as leituras. Verifique sua conexão.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [leituras]
  );

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      carregarLeituras(currentPage + 1);
    }
  }, [loading, hasMore, currentPage, carregarLeituras]);

  useEffect(() => {
    carregarLeituras(1); // Iniciar com a página 1
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    carregarLeituras(1); // Recarregar a primeira página
  };

  // Usando o contexto para salvar faturas e navegar
  const handleCardPress = (leitura: LeituraMensal) => {
    // Salvamos os dados no contexto
    setFaturasSelecionadas(leitura.faturas);
    setMesAnoSelecionado(leitura.mesAno);

    // Navegamos para a tela de detalhes
    router.push("/LeiturasDetalhes");
  };

  // Renderiza um indicador de "carregando mais" no final da lista
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
          ListFooterComponent={renderFooter}
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

// Estilos permanecem os mesmos...
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
    paddingBottom: 60, // Espaço extra no final da lista
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
});

export default LeiturasScreen;
