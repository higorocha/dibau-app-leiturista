// src/components/common/SyncProgressModal.tsx
import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

interface SyncProgressModalProps {
  visible: boolean;
  title: string;
  message: string;
  progress: number; // 0-100
  itemsProcessed: number;
  totalItems: number;
  onCancel?: () => void;
  allowCancel?: boolean;
  type?: "upload" | "download" | "sync"; // Tipo de operação para icone adequado
  // Propriedades para o processo secundário
  secondaryProgress?: number;
  secondaryMessage?: string;
  secondaryItemsProcessed?: number;
  secondaryTotalItems?: number;
}

const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  visible,
  title,
  message,
  progress,
  itemsProcessed,
  totalItems,
  onCancel,
  allowCancel = true,
  type = "sync",
  // Parâmetros secundários opcionais
  secondaryProgress,
  secondaryMessage,
  secondaryItemsProcessed,
  secondaryTotalItems,
}) => {
  // Animação para barra de progresso principal
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Animação para barra de progresso secundária
  const secondaryProgressAnim = useRef(new Animated.Value(0)).current;

  // Atualizar a animação principal conforme o progresso muda
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Atualizar a animação secundária conforme o progresso secundário muda
  useEffect(() => {
    if (secondaryProgress !== undefined) {
      Animated.timing(secondaryProgressAnim, {
        toValue: secondaryProgress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [secondaryProgress, secondaryProgressAnim]);

  // Determinar ícone com base no tipo
  const getIcon = () => {
    switch (type) {
      case "upload":
        return "cloud-upload-outline";
      case "download":
        return "cloud-download-outline";
      case "sync":
      default:
        return "sync-outline";
    }
  };

  // Não renderizar se não estiver visível
  if (!visible) return null;

  // Verificar se temos um processo secundário para exibir
  const hasDualProcess = secondaryProgress !== undefined;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Ícone e título */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={getIcon()}
                size={isTablet ? 36 : 30}
                color="#2a9d8f"
              />
            </View>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              {title}
            </Text>
          </View>

          {/* Processo principal */}
          <View style={styles.processContainer}>
            {/* Barra de progresso principal */}
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>

            {/* Status numérico principal */}
            <Text style={styles.progressText}>
              {itemsProcessed} de {totalItems}{" "}
              {itemsProcessed === 1 ? "leitura" : "leituras"} processados (
              {Math.round(progress)}%)
            </Text>

            {/* Mensagem explicativa principal */}
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Processo secundário (se existir) */}
          {hasDualProcess && (
            <View style={styles.processContainer}>
              <View style={styles.processDivider} />

              {/* Barra de progresso secundária */}
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: secondaryProgressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                      backgroundColor: "#1890ff", // cor diferente para o processo secundário
                    },
                  ]}
                />
              </View>

              {/* Status numérico secundário */}
              {secondaryItemsProcessed !== undefined && secondaryTotalItems !== undefined && (
                <Text style={styles.progressText}>
                  {secondaryItemsProcessed} de {secondaryTotalItems}{" "}
                  {secondaryItemsProcessed === 1 ? "imagem" : "imagens"} processada
                  {secondaryItemsProcessed !== 1 ? "s" : ""} (
                  {Math.round(secondaryProgress || 0)}%)
                </Text>
              )}

              {/* Mensagem explicativa secundária */}
              {secondaryMessage && (
                <Text style={styles.message}>{secondaryMessage}</Text>
              )}
            </View>
          )}

          {/* Botão de cancelar (opcional) */}
          {allowCancel && onCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
              <Ionicons name="close-circle-outline" size={18} color="#e63946" />
            </TouchableOpacity>
          )}

          {/* Indicador de atividade girando */}
          <ActivityIndicator
            style={styles.spinner}
            size={isTablet ? "large" : "small"}
            color="#2a9d8f"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  containerTablet: {
    maxWidth: 480,
    padding: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: isTablet ? 40 : 30,
    backgroundColor: "rgba(42, 157, 143, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
  titleTablet: {
    fontSize: 24,
  },
  processContainer: {
    width: "100%",
    marginBottom: 16,
  },
  processDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    width: "100%",
    marginVertical: 16,
  },
  progressContainer: {
    width: "100%",
    height: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#2a9d8f",
    borderRadius: 6,
  },
  progressText: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    marginBottom: 8,
  },
  message: {
    fontSize: isTablet ? 16 : 14,
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: isTablet ? 24 : 20,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(230, 57, 70, 0.1)",
  },
  cancelText: {
    color: "#e63946",
    marginRight: 6,
    fontWeight: "500",
  },
  spinner: {
    position: "absolute",
    top: 20,
    right: 20,
  },
});

export default SyncProgressModal;