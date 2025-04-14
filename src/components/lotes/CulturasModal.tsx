// src/components/lotes/CulturasModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Dimensions,
  Platform,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import Toast from "react-native-toast-message";
import api from "../../api/axiosConfig";
// Importar os tipos do arquivo compartilhado
import { Lote, Cultura, LoteCultura } from "../../types/models";
import ModalToast from "../common/ModalToast";

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

// Interface para entrada numérica
interface NumericInputProps {
  value: number;
  onValueChange: (value: number) => void;
  style?: any;
  keyboardType?: string;
}

// Componente customizado para entrada numérica
const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  style,
  keyboardType = "numeric",
}) => {
  const [inputValue, setInputValue] = useState<string>(
    value?.toString() || "0"
  );

  // Atualizar o input quando o valor mudar externamente
  useEffect(() => {
    setInputValue(value?.toString() || "0");
  }, [value]);

  const handleChange = (text: string) => {
    // Permitir apenas dígitos e ponto decimal
    const formattedText = text.replace(/[^0-9.]/g, "");
    setInputValue(formattedText);

    // Converter para número e chamar callback
    const numericValue = parseFloat(formattedText) || 0;
    onValueChange(numericValue);
  };

  return (
    <TextInput
      value={inputValue}
      onChangeText={handleChange}
      keyboardType={keyboardType as any}
      style={style}
    />
  );
};

// Interface para props do componente
interface CulturasModalProps {
  visible: boolean;
  onClose: () => void;
  lote: Lote | null;
  culturas: Cultura[];
  lotesCulturas: LoteCultura[];
  onSave: (data: LoteCultura[], deletedCultureIds: number[]) => void;
}

const CulturasModal: React.FC<CulturasModalProps> = ({
  visible,
  onClose,
  lote,
  culturas,
  lotesCulturas,
  onSave,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [culturasLote, setCulturasLote] = useState<LoteCultura[]>([]);
  const [allCulturas, setAllCulturas] = useState<Cultura[]>([]);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newCultura, setNewCultura] = useState<LoteCultura>({
    culturaId: 0,
    areaPlantada: 0,
    areaProduzindo: 0,
    isNew: true,
    isEditing: true,
  });
  const [changesMade, setChangesMade] = useState<boolean>(false);
  const [deletedCultureIds, setDeletedCultureIds] = useState<number[]>([]);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
    visible: boolean;
  } | null>(null);

  const showModalToast = (text: string, type: "success" | "error" | "info") => {
    setToastMessage({ text, type, visible: true });

    // Auto-hide after 2.5 seconds
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Verificar conexão
  useEffect(() => {
    const checkConnection = async () => {
      const netInfo = await NetInfo.fetch();
      setIsOffline(!netInfo.isConnected);
    };

    checkConnection();
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Inicializar dados quando o modal é aberto
  useEffect(() => {
    if (visible && lote) {
      setCulturasLote(lotesCulturas.map((c) => ({ ...c })));
      setAllCulturas(culturas);
      setIsAddingNew(false);
      setChangesMade(false);
      setDeletedCultureIds([]); // Reset deleted IDs quando abre o modal
    }
  }, [visible, lote, lotesCulturas, culturas]);

  // Funções para manipular culturas
  const handleEditCultura = (index: number) => {
    const updatedCulturas = [...culturasLote];
    updatedCulturas[index] = {
      ...updatedCulturas[index],
      isEditing: true,
    };
    setCulturasLote(updatedCulturas);
    setChangesMade(true);
  };

  const handleDeleteCultura = (index: number) => {
    const updatedCulturas = [...culturasLote];
    const isCurrentlyDeleted = updatedCulturas[index].isDeleted;

    // Inverter o estado de isDeleted
    updatedCulturas[index] = {
      ...updatedCulturas[index],
      isDeleted: !isCurrentlyDeleted,
    };
    setCulturasLote(updatedCulturas);
    setChangesMade(true);

    // Rastrear ID da cultura para exclusão
    const culturaId = updatedCulturas[index].culturaId;

    if (!isCurrentlyDeleted) {
      // Se não estava marcada como excluída e agora está, adicionar à lista
      if (!deletedCultureIds.includes(culturaId)) {
        setDeletedCultureIds([...deletedCultureIds, culturaId]);
      }
    } else {
      // Se estava marcada como excluída e agora não está, remover da lista
      setDeletedCultureIds(deletedCultureIds.filter((id) => id !== culturaId));
    }

    const message = !isCurrentlyDeleted
      ? "Cultura marcada para exclusão"
      : "Exclusão cancelada";
    const toastType = !isCurrentlyDeleted ? "error" : "info";

    showModalToast(`${message}. Salve as alterações para aplicar.`, toastType);
  };

  const handleSaveCultura = (index: number) => {
    // Validações
    const cultura = culturasLote[index];

    if (cultura.areaPlantada <= 0) {
      Alert.alert("Erro", "Área plantada deve ser maior que zero");
      return;
    }

    if (cultura.areaProduzindo > cultura.areaPlantada) {
      Alert.alert(
        "Erro",
        "Área produzindo não pode ser maior que área plantada"
      );
      return;
    }

    const updatedCulturas = [...culturasLote];
    updatedCulturas[index] = {
      ...updatedCulturas[index],
      isEditing: false,
      isSaved: true,
    };
    setCulturasLote(updatedCulturas);
    setChangesMade(true);
  };

  const handleUpdateField = (
    index: number,
    field: keyof LoteCultura,
    value: any
  ) => {
    const updatedCulturas = [...culturasLote];
    updatedCulturas[index] = {
      ...updatedCulturas[index],
      [field]: value,
    };
    setCulturasLote(updatedCulturas);
  };

  const handleAddNewCultura = () => {
    setIsAddingNew(true);
    setNewCultura({
      culturaId: 0,
      areaPlantada: 0,
      areaProduzindo: 0,
      isNew: true,
      isEditing: true,
    });
  };

  const handleSaveNewCultura = () => {
    // Validar culturaId
    if (newCultura.culturaId === 0) {
      Alert.alert("Erro", "Selecione uma cultura válida");
      return;
    }

    // Validar área plantada
    if (newCultura.areaPlantada <= 0) {
      Alert.alert("Erro", "Área plantada deve ser maior que zero");
      return;
    }

    // Validar área produzindo não maior que área plantada
    if (newCultura.areaProduzindo > newCultura.areaPlantada) {
      Alert.alert(
        "Erro",
        "Área produzindo não pode ser maior que área plantada"
      );
      return;
    }

    setCulturasLote([...culturasLote, { ...newCultura, isSaved: true }]);
    setIsAddingNew(false);
    setChangesMade(true);

    showModalToast(
      "Nova cultura adicionada. Salve as alterações para aplicar.",
      "success"
    );
  };

  const handleCancelNewCultura = () => {
    setIsAddingNew(false);
  };

  // Função auxiliar para salvar offline
  const saveOffline = async (culturasFormatadas: any[]) => {
    if (!lote) return;

    try {
      // Buscar dados pendentes existentes
      const pendingDataStr =
        (await AsyncStorage.getItem("pendingCulturasUpdates")) || "{}";
      const pendingData = JSON.parse(pendingDataStr);

      // Adicionar/atualizar este lote com formato melhorado incluindo IDs excluídos
      pendingData[lote.id] = {
        loteId: lote.id,
        culturas: culturasFormatadas,
        deletedCultureIds: deletedCultureIds,
        timestamp: new Date().toISOString(),
      };

      // Salvar no AsyncStorage
      await AsyncStorage.setItem(
        "pendingCulturasUpdates",
        JSON.stringify(pendingData)
      );

      showModalToast(
        "Alterações salvas localmente. Serão sincronizadas quando houver conexão.",
        "info"
      );

      // Chamar callback para atualizar dados na tela principal com flag de pendente
      // Passando tanto as culturas atualizadas quanto os IDs excluídos
      onSave(
        culturasLote
          .filter((c) => !c.isDeleted)
          .map((c) => ({ ...c, isPending: true })),
        deletedCultureIds
      );

      // Fechar modal
      onClose();
    } catch (storageError) {
      console.error("Erro ao salvar dados offline:", storageError);
      Alert.alert("Erro", "Não foi possível salvar os dados offline.");
    }
  };

  // Função para salvar todas as alterações
  const handleSaveChanges = async () => {
    if (!lote) return;

    // Preparar dados para envio
    const culturasFormatadas = culturasLote
      .filter((c) => !c.isDeleted) // Excluir culturas marcadas para exclusão
      .map((c) => ({
        culturaId: c.culturaId,
        areaPlantada: c.areaPlantada,
        areaProduzindo: c.areaProduzindo,
        isNew: c.isNew || false,
      }));

    // Mostrar loading
    setLoading(true);

    // Verificar conexão
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected;

    if (isConnected) {
      // MODO ONLINE: Enviar para a API
      try {
        await api.put(`/lotesagricolas/${lote.id}`, {
          // Manter os dados originais do lote
          id: lote.id,
          nomeLote: lote.nomeLote,
          responsavelId: lote.responsavelId,
          areaTotal: lote.areaTotal,
          areaLote: lote.areaLote || 0,
          sobraarea: lote.sobraarea || 0,
          consorcioCulturas: culturasFormatadas.length > 1,
          categoria: lote.categoria || "Colono",
          situacao: lote.situacao || "Operacional",
          // Enviar as culturas atualizadas
          culturas: culturasFormatadas,
        });

        // Verificar pendências existentes e removê-las
        try {
          const pendingDataStr =
            (await AsyncStorage.getItem("pendingCulturasUpdates")) || "{}";
          const pendingData = JSON.parse(pendingDataStr);

          if (pendingData[lote.id]) {
            delete pendingData[lote.id];
            await AsyncStorage.setItem(
              "pendingCulturasUpdates",
              JSON.stringify(pendingData)
            );
          }
        } catch (e) {
          console.error("Erro ao limpar pendências:", e);
        }

        Toast.show({
            type: 'success',
            text1: 'Culturas atualizadas com sucesso!',
            position: 'bottom',
            visibilityTime: 2000,
          });
        // Chamar callback para atualizar dados na tela principal
        // Passando tanto as culturas atualizadas quanto os IDs excluídos
        onSave(
          culturasLote.filter((c) => !c.isDeleted),
          deletedCultureIds
        );

        // Fechar modal
        onClose();
      } catch (error) {
        console.error("Erro ao atualizar culturas:", error);
        Alert.alert(
          "Erro",
          "Ocorreu um erro ao atualizar as culturas. Salvando localmente..."
        );

        // Se falhar online, salvar offline
        await saveOffline(culturasFormatadas);
      }
    } else {
      // MODO OFFLINE: Salvar localmente
      await saveOffline(culturasFormatadas);
    }

    setLoading(false);
  };

  // Função para renderizar cada item da cultura
  const renderCulturaItem = ({
    item,
    index,
  }: {
    item: LoteCultura;
    index: number;
  }) => {
    // Buscar nome da cultura
    const culturaNome =
      allCulturas.find((c) => c.id === item.culturaId)?.descricao ||
      "Cultura não encontrada";

    return (
      <View
        style={[
          styles.culturaCard,
          item.isDeleted && styles.culturaCardDeleted,
          item.isSaved && styles.culturaCardSaved,
        ]}
      >
        {/* Badge de status */}
        {item.isDeleted && (
          <View style={styles.statusBadge}>
            <Ionicons name="trash" size={14} color="#fff" />
            <Text style={styles.statusText}>Será excluída</Text>
          </View>
        )}
        {item.isSaved && !item.isDeleted && (
          <View style={[styles.statusBadge, styles.statusBadgeSaved]}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.statusText}>Alterada</Text>
          </View>
        )}

        {/* Cabeçalho */}
        <View style={styles.culturaHeader}>
          <Ionicons name="leaf-outline" size={18} color="#2a9d8f" />
          <Text style={styles.culturaNome}>{culturaNome}</Text>
        </View>

        {/* Campos de área */}
        <View style={styles.culturaFields}>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Área Plantada (ha)</Text>
            {item.isEditing ? (
              <View style={styles.inputContainer}>
                <NumericInput
                  value={item.areaPlantada}
                  onValueChange={(value: number) =>
                    handleUpdateField(index, "areaPlantada", value)
                  }
                  style={styles.input}
                />
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {item.areaPlantada.toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Área Produzindo (ha)</Text>
            {item.isEditing ? (
              <View style={styles.inputContainer}>
                <NumericInput
                  value={item.areaProduzindo}
                  onValueChange={(value: number) =>
                    handleUpdateField(index, "areaProduzindo", value)
                  }
                  style={styles.input}
                />
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {item.areaProduzindo.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Botões de ação */}
        <View style={styles.actionsContainer}>
          {item.isEditing ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => handleSaveCultura(index)}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.buttonText}>Salvar</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEditCultura(index)}
                disabled={item.isDeleted}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  item.isDeleted ? styles.restoreButton : styles.deleteButton,
                ]}
                onPress={() => handleDeleteCultura(index)}
              >
                <Ionicons
                  name={item.isDeleted ? "refresh" : "trash-outline"}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.buttonText}>
                  {item.isDeleted ? "Restaurar" : "Excluir"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // Renderização do componente de adição de cultura
  const renderAddCultura = () => {
    if (!isAddingNew) return null;

    return (
      <View style={styles.culturaCard}>
        <View style={styles.culturaHeader}>
          <Ionicons name="leaf-outline" size={18} color="#2a9d8f" />
          <Text style={styles.culturaNome}>Nova Cultura</Text>
        </View>

        {/* Seleção de cultura */}
        <View style={styles.pickerContainer}>
          <Text style={styles.fieldLabel}>Selecione a Cultura</Text>
          <Picker
            selectedValue={newCultura.culturaId}
            onValueChange={(value: number) =>
              setNewCultura({ ...newCultura, culturaId: value })
            }
            style={styles.picker}
          >
            <Picker.Item label="Selecione..." value={0} />
            {allCulturas.map((c) => (
              <Picker.Item key={c.id} label={c.descricao} value={c.id} />
            ))}
          </Picker>
        </View>

        {/* Campos de área */}
        <View style={styles.culturaFields}>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Área Plantada (ha)</Text>
            <View style={styles.inputContainer}>
              <NumericInput
                value={newCultura.areaPlantada}
                onValueChange={(value: number) =>
                  setNewCultura({ ...newCultura, areaPlantada: value })
                }
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Área Produzindo (ha)</Text>
            <View style={styles.inputContainer}>
              <NumericInput
                value={newCultura.areaProduzindo}
                onValueChange={(value: number) =>
                  setNewCultura({ ...newCultura, areaProduzindo: value })
                }
                style={styles.input}
              />
            </View>
          </View>
        </View>

        {/* Botões de ação */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveNewCultura}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.buttonText}>Adicionar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleCancelNewCultura}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {/* Toast interno */}
          {toastMessage && toastMessage.visible && (
            <View
              style={[
                styles.toastContainer,
                toastMessage.type === "success" && {
                  backgroundColor: "#2a9d8f",
                },
                toastMessage.type === "error" && { backgroundColor: "#e63946" },
                toastMessage.type === "info" && { backgroundColor: "#3498db" },
              ]}
            >
              <Ionicons
                name={
                  toastMessage.type === "success"
                    ? "checkmark-circle"
                    : toastMessage.type === "error"
                    ? "alert-circle"
                    : "information-circle"
                }
                size={20}
                color="#fff"
              />
              <Text style={styles.toastText}>{toastMessage.text}</Text>
            </View>
          )}
          {/* Cabeçalho do modal */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Culturas do Lote: {lote?.nomeLote || ""} - {lote?.areaLote} ha
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Indicador offline */}
          {isOffline && (
            <View style={styles.offlineBar}>
              <Ionicons name="cloud-offline" size={18} color="#fff" />
              <Text style={styles.offlineText}>Modo offline</Text>
            </View>
          )}

          {/* Lista de culturas */}
          <FlatList
            data={culturasLote}
            renderItem={renderCulturaItem}
            keyExtractor={(item, index) => `cultura-${item.culturaId}-${index}`}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Nenhuma cultura cadastrada para este lote
                </Text>
              </View>
            }
            ListFooterComponent={
              <>
                {renderAddCultura()}
                <View style={styles.footerSpace} />
              </>
            }
            contentContainerStyle={styles.listContent}
          />

          {/* Botões de ação do modal */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.addButton,
                isAddingNew && styles.disabledButton,
              ]}
              onPress={handleAddNewCultura}
              disabled={isAddingNew}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.footerButtonText}>Adicionar Cultura</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.saveAllButton,
                (!changesMade || isAddingNew) && styles.disabledButton,
              ]}
              onPress={handleSaveChanges}
              disabled={!changesMade || isAddingNew || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.footerButtonText}>
                    Salvar Modificações
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    width: isTablet ? "80%" : "90%",
    height: isTablet ? "80%" : "90%",
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
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
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  culturaCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#2a9d8f",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  culturaCardDeleted: {
    borderLeftColor: "#ff6b6b",
    opacity: 0.7,
    backgroundColor: "#ffefef",
  },
  culturaCardSaved: {
    borderLeftColor: "#2a9d8f",
    backgroundColor: "#f0fffc",
  },
  statusBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ff6b6b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  statusBadgeSaved: {
    backgroundColor: "#2a9d8f",
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    marginLeft: 4,
  },
  culturaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  culturaNome: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
  },
  culturaFields: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fieldContainer: {
    width: "48%",
  },
  fieldLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 4,
  },
  input: {
    fontSize: 14,
    color: "#333",
    padding: 4,
  },
  pickerContainer: {
    marginBottom: 12,
  },
  picker: {
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  saveButton: {
    backgroundColor: "#2a9d8f",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  editButton: {
    backgroundColor: "#3498db",
  },
  deleteButton: {
    backgroundColor: "#ff6b6b",
  },
  restoreButton: {
    backgroundColor: "#f39c12",
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  footerSpace: {
    height: 60,
  },
  modalFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
  },
  addButton: {
    backgroundColor: "#3498db",
  },
  saveAllButton: {
    backgroundColor: "#2a9d8f",
  },
  disabledButton: {
    opacity: 0.5,
  },
  footerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 6,
  },
  toastContainer: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "#3498db",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
    elevation: 10,
  },
  toastText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});

export default CulturasModal;
