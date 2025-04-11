// src/screens/leituras/LeiturasDetalhesScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLeiturasContext } from "../../contexts/LeiturasContext";
import api from "../../api/axiosConfig";
import MaskedNumberInput from "../../components/inputs/MaskedNumberInput";
import { formatarNumeroComMilhar, formatarData } from "../../utils/formatters";

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

// Interface para Fatura
interface Fatura {
  id: number;
  id_hidrometro: number;
  valor_leitura_m3: number;
  leitura_anterior: number;
  data_leitura_anterior: string;
  fechada: string;
  status: string;
  Hidrometro: {
    id: number;
    codHidrometro: string;
    modelo: string;
    registro_atual: number;
  };
  LoteAgricola: {
    id: number;
    nomeLote: string;
  };
  Cliente: {
    id: number;
    nome: string;
  };
  Leitura?: {
    leitura: number;
    data_leitura: string;
  };
}

const LeiturasDetalhesScreen: React.FC = () => {
  // Obtendo os dados do contexto
  const { faturasSelecionadas, mesAnoSelecionado, setFaturasSelecionadas } =
    useLeiturasContext();

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [leituraAtuais, setLeituraAtuais] = useState<{ [key: number]: string }>(
    {}
  );
  const [dataLeituraAtuais, setDataLeituraAtuais] = useState<{
    [key: number]: Date;
  }>({});
  const [showDatePicker, setShowDatePicker] = useState<{
    [key: number]: boolean;
  }>({});
  const [salvando, setSalvando] = useState<{ [key: number]: boolean }>({});
  const [valoresOriginais, setValoresOriginais] = useState<{
    [key: number]: string;
  }>({});

  // Inicializar os estados com os dados existentes
  useEffect(() => {
    const leituras: { [key: number]: string } = {};
    const datas: { [key: number]: Date } = {};

    faturasSelecionadas.forEach((fatura) => {
      leituras[fatura.id] = fatura.Leitura?.leitura
        ? fatura.Leitura.leitura.toString()
        : "";

      datas[fatura.id] = fatura.Leitura?.data_leitura
        ? new Date(fatura.Leitura.data_leitura)
        : new Date();
    });

    setLeituraAtuais(leituras);
    setDataLeituraAtuais(datas);
  }, [faturasSelecionadas]);

  const handleEdit = (faturaId: number) => {
    setEditingId(faturaId);

    // Armazenar o valor original para uso posterior em caso de cancelamento
    const fatura = faturasSelecionadas.find((f) => f.id === faturaId);
    if (fatura) {
      setValoresOriginais((prev) => ({
        ...prev,
        [faturaId]: fatura.Leitura?.leitura.toString() || "",
      }));
    }
  };

  const handleCancel = () => {
    if (editingId) {
      // Restaurar valor original
      setLeituraAtuais((prev) => ({
        ...prev,
        [editingId]: valoresOriginais[editingId] || "",
      }));
    }
    setEditingId(null);
  };

  const showDatepicker = (faturaId: number) => {
    setShowDatePicker((prev) => ({
      ...prev,
      [faturaId]: true,
    }));
  };

  const onDateChange = (
    event: DateTimePickerEvent,
    selectedDate: Date | undefined,
    faturaId: number
  ) => {
    setShowDatePicker((prev) => ({
      ...prev,
      [faturaId]: false,
    }));

    if (selectedDate) {
      setDataLeituraAtuais((prev) => ({
        ...prev,
        [faturaId]: selectedDate,
      }));
    }
  };

  const handleSave = async (fatura: Fatura) => {
    // Validações
    const leituraAtual = leituraAtuais[fatura.id];
    if (!leituraAtual || leituraAtual.trim() === "") {
      Alert.alert("Erro", "Por favor, informe a leitura atual.");
      return;
    }

    // Remover a formatação para enviar para a API
    const leituraAtualNum = parseFloat(
      leituraAtual.replace(/\./g, "").replace(",", ".")
    );
    const leituraAnterior = fatura.leitura_anterior || 0;

    // Verificar se a leitura atual é menor que a anterior
    if (leituraAtualNum < leituraAnterior) {
      const confirmaZerado = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Confirmação",
          `A leitura atual (${leituraAtualNum}) é menor que a anterior (${leituraAnterior}). Deseja continuar mesmo assim?`,
          [
            { text: "Não", onPress: () => resolve(false), style: "cancel" },
            { text: "Sim", onPress: () => resolve(true) },
          ]
        );
      });

      if (!confirmaZerado) return;
    }

    // Mostrar indicador de carregamento para esta linha
    setSalvando((prev) => ({
      ...prev,
      [fatura.id]: true,
    }));

    try {
      // Formatar a data para envio
      const dataFormatada = new Date(dataLeituraAtuais[fatura.id])
        .toISOString()
        .split("T")[0]; // Formato YYYY-MM-DD

      // Chamar a API para atualizar a leitura
      const response = await api.put(
        `/faturamensal/atualizar-leitura/${fatura.id}`,
        {
          leitura: leituraAtualNum,
          data_leitura: dataFormatada,
        }
      );

      if (response.status === 200) {
        // ATUALIZAÇÃO DOS DADOS LOCAIS
        // Este é o ponto chave para atualizar os dados após salvar
        setFaturasSelecionadas(
          faturasSelecionadas.map((f) => {
            if (f.id === fatura.id) {
              return {
                ...f,
                Leitura: {
                  ...f.Leitura,
                  leitura: leituraAtualNum,
                  data_leitura: dataFormatada,
                },
              };
            }
            return f;
          })
        );

        Alert.alert("Sucesso", "Leitura atualizada com sucesso!");
        setEditingId(null);
      }
    } catch (error: any) {
      console.error("Erro ao salvar leitura:", error);
      Alert.alert(
        "Erro",
        error.response?.data?.error ||
          "Erro ao salvar a leitura. Tente novamente."
      );
    } finally {
      setSalvando((prev) => ({
        ...prev,
        [fatura.id]: false,
      }));
    }
  };

  const renderItem = ({ item }: { item: Fatura }) => {
    const isEditing = editingId === item.id;
    const isSaving = salvando[item.id] || false;
    const isDisabled = item.fechada === "Sim";

    return (
      <View style={styles.card}>
        {/* Cabeçalho do Card - Lote e Hidrômetro */}
        <View style={styles.cardHeader}>
          <View style={styles.loteContainer}>
            <Ionicons name="map-outline" size={24} color="#2a9d8f" />
            <Text style={styles.loteText}>{item.LoteAgricola.nomeLote}</Text>
          </View>
          <View style={styles.hidrometroContainer}>
            <Ionicons name="water-outline" size={22} color="#2a9d8f" />
            <Text style={styles.hidrometroText}>
              Hidrômetro {item.Hidrometro.codHidrometro}
            </Text>
          </View>
        </View>

        {/* Linha Divisória */}
        <View style={styles.divider} />

        {/* Corpo do Card - Informações de Leitura */}
        <View style={styles.cardBody}>
          {/* Linha 1: Valores Anteriores */}
          <View style={styles.infoRow}>
            {/* Leitura Anterior */}
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Ionicons name="analytics-outline" size={18} color="#666" />
                <Text style={styles.infoLabel}>Leitura Anterior</Text>
              </View>
              <Text style={styles.infoValue}>
                {formatarNumeroComMilhar(item.leitura_anterior || 0)} m³
              </Text>
            </View>

            {/* Data Leitura Anterior */}
            <View style={styles.infoItem}>
              <View style={styles.infoHeader}>
                <Ionicons name="calendar-outline" size={18} color="#666" />
                <Text style={styles.infoLabel}>Data Anterior</Text>
              </View>
              <Text style={styles.infoValue}>
                {formatarData(item.data_leitura_anterior || "")}
              </Text>
            </View>
          </View>

          {/* Linha 2: Valores Atuais (com possibilidade de edição) */}
          <View style={styles.infoRow}>
            {/* Leitura Atual */}
            <View style={[styles.infoItem, styles.highlightedItem]}>
              <View style={styles.infoHeader}>
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color="#2a9d8f"
                />
                <Text style={[styles.infoLabel, { color: "#2a9d8f" }]}>
                  Leitura Atual
                </Text>
              </View>
              {isEditing ? (
                <MaskedNumberInput
                  style={styles.input}
                  value={leituraAtuais[item.id]}
                  onChangeText={(text) =>
                    setLeituraAtuais((prev) => ({ ...prev, [item.id]: text }))
                  }
                  placeholder="Informe a leitura"
                />
              ) : (
                <Text style={[styles.infoValue, styles.highlightedValue]}>
                  {item.Leitura
                    ? formatarNumeroComMilhar(item.Leitura.leitura) + " m³"
                    : "-"}
                </Text>
              )}
            </View>

            {/* Data Leitura Atual */}
            <View style={[styles.infoItem, styles.highlightedItem]}>
              <View style={styles.infoHeader}>
                <Ionicons name="today-outline" size={18} color="#2a9d8f" />
                <Text style={[styles.infoLabel, { color: "#2a9d8f" }]}>
                  Data Atual
                </Text>
              </View>
              {isEditing ? (
                <View>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => showDatepicker(item.id)}
                  >
                    <Text style={styles.dateButtonText}>
                      {formatarData(dataLeituraAtuais[item.id])}
                    </Text>
                    <Ionicons name="calendar" size={18} color="#2a9d8f" />
                  </TouchableOpacity>

                  {showDatePicker[item.id] && (
                    <DateTimePicker
                      value={dataLeituraAtuais[item.id]}
                      mode="date"
                      display="default"
                      onChange={(event, date) =>
                        onDateChange(event, date, item.id)
                      }
                      maximumDate={new Date()}
                      locale="pt-BR" // Configurando o locale para português Brasil
                    />
                  )}
                </View>
              ) : (
                <Text style={[styles.infoValue, styles.highlightedValue]}>
                  {item.Leitura ? formatarData(item.Leitura.data_leitura) : "-"}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Rodapé com Botões de Ação */}
        <View style={styles.cardFooter}>
          {isEditing ? (
            // Modo Edição: Botões Salvar e Cancelar
            <>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSave(item)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Salvar</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Ionicons name="close-circle-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Modo Visualização: Botão Editar
            <TouchableOpacity
              style={[styles.editButton, { opacity: isDisabled ? 0.5 : 1 }]}
              onPress={() => handleEdit(item.id)}
              disabled={isDisabled}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {isDisabled ? "Fatura Fechada" : "Editar"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Badge */}
        {item.status === "Paga" && (
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.statusText}>Paga</Text>
          </View>
        )}
        {item.status === "Vencida" && (
          <View style={[styles.statusBadge, styles.statusVencida]}>
            <Ionicons name="alert-circle" size={18} color="#fff" />
            <Text style={styles.statusText}>Vencida</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Detalhes de Leituras</Text>
            <Text style={styles.headerSubtitle}>{mesAnoSelecionado}</Text>
          </View>
        </View>

        <FlatList
          data={faturasSelecionadas}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma leitura disponível</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: "#2a9d8f",
    padding: 16,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 16,
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
  listContent: {
    padding: 16,
    paddingBottom: 60,
  },

  // Estilo do Card
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: "relative", // Para o badge de status
  },

  // Cabeçalho do Card
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  loteContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 2,
  },
  loteText: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
  },
  hidrometroContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  hidrometroText: {
    fontSize: isTablet ? 15 : 13,
    color: "#555",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
  },

  // Corpo do Card
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoItem: {
    width: "48%",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
  },
  highlightedItem: {
    backgroundColor: "rgba(42, 157, 143, 0.1)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    marginLeft: 4,
  },
  infoValue: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "bold",
    color: "#333",
  },
  highlightedValue: {
    color: "#2a9d8f",
    fontSize: isTablet ? 18 : 16,
  },

  // Input e DatePicker
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#2a9d8f",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    fontSize: isTablet ? 16 : 14,
    color: "#333",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#2a9d8f",
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  dateButtonText: {
    fontSize: isTablet ? 16 : 14,
    color: "#333",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  editButton: {
    backgroundColor: "#1890ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: "60%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButton: {
    backgroundColor: "#52c41a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    backgroundColor: "#ff4d4f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: "white",
    marginLeft: 8,
    fontWeight: "500",
    fontSize: isTablet ? 15 : 13,
  },

  // Status Badge
  statusBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#52c41a",
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusVencida: {
    backgroundColor: "#ff4d4f",
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: isTablet ? 13 : 11,
  },

  // Container vazio
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});

export default LeiturasDetalhesScreen;
