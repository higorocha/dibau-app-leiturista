// src/components/leituras/LeituraCard.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatarNumeroComMilhar, formatMesAno } from "@/src/utils/formatters";
import Toast from "react-native-toast-message";

// Verificar se é tablet
const { width } = Dimensions.get("window");
const isTablet = width > 600;

// Interface para as propriedades do componente - Adicionando props corretamente
interface LeituraCardProps {
  mesAno: string;
  leiturasInformadas: number;
  totalLeituras: number;
  volumeTotal: number;
  dataCriacao: string;
  faturas: any[];
  onPress: () => void;
  isEmpty?: boolean;
  isAllFechada: boolean;
  temDadosPendentes?: boolean;
  onSincronizar?: () => void;
  volumePositivo?: number; // Nova prop
  temConsumosNegativos?: boolean; // Nova prop
}

const LeituraCard: React.FC<LeituraCardProps> = ({
  mesAno,
  leiturasInformadas,
  totalLeituras,
  volumeTotal,
  dataCriacao,
  faturas,
  onPress,
  isEmpty = false,
  isAllFechada,
  temDadosPendentes = false,
  onSincronizar,
  volumePositivo, // Desestruturar corretamente
  temConsumosNegativos = false, // Valor padrão
}) => {
  // Usar volumePositivo recebido via props ou fallback para volumeTotal
  const volumeFinal = volumePositivo !== undefined ? volumePositivo : volumeTotal;

  // Verificar se é um card vazio
  if (isEmpty) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>
          Nenhuma leitura cadastrada. Utilize o sistema web para adicionar
          leituras.
        </Text>
      </View>
    );
  }

  // Formatar data de criação
  const dataFormatada = new Date(dataCriacao).toLocaleDateString("pt-BR");

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderLeftWidth: 4,
          borderLeftColor: isAllFechada ? "#2a9d8f" : "transparent",
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Badge de Alertas */}
      {temConsumosNegativos && (
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>Consumos Negativos</Text>
        </View>
      )}
      
      <View style={styles.cardHeader}>
        <Text style={styles.title}>Leituras {formatMesAno(mesAno)}</Text>
        <Text style={styles.subtitle}>Criado em: {dataFormatada}</Text>
        
        {/* Badge de sincronização */}
        {temDadosPendentes && (
          <TouchableOpacity 
            style={styles.syncBadge}
            onPress={(e) => {
              e.stopPropagation(); // Evitar que o card seja aberto
              if (onSincronizar) onSincronizar();
            }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.syncBadgeText}>Sincronizar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="document-text-outline"
              size={isTablet ? 32 : 28}
              color="#2a9d8f"
            />
          </View>
          <Text style={styles.statLabel}>Quantidade de Leituras</Text>
          <View style={styles.statValueContainer}>
            <Text style={styles.statValue}>
              {isAllFechada
                ? `${totalLeituras}/${totalLeituras}`
                : `${leiturasInformadas}/${totalLeituras}`}
            </Text>

            {isAllFechada && (
              <TouchableOpacity
                onPress={() => {
                  Toast.show({
                    type: "info",
                    text1: "Status das Faturas",
                    text2: "Todas as faturas deste mês estão fechadas",
                    visibilityTime: 3000,
                  });
                }}
              >
                <Ionicons
                  name="lock-closed"
                  size={isTablet ? 20 : 16}
                  color="#2a9d8f"
                  style={styles.lockIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.statItem}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="water-outline"
              size={isTablet ? 32 : 28}
              color="#2a9d8f"
            />
          </View>
          <Text style={styles.statLabel}>Volume Total (m³)</Text>
          <Text style={styles.statValue}>
            {formatarNumeroComMilhar(volumeFinal)}
          </Text>
        </View>
      </View>
      
      {/* Alerta de consumos negativos */}
      {temConsumosNegativos && (
        <View style={styles.alertContainer}>
          <Ionicons name="warning-outline" size={16} color="#faad14" style={{marginRight: 8}} />
          <Text style={styles.alertText}>
            Existem consumos negativos que foram desconsiderados no cálculo.
            Volume com negativos: {formatarNumeroComMilhar(volumeTotal)} m³
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: isTablet ? 24 : 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    position: "relative", // Para posicionar o badge corretamente
  },
  emptyCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  cardHeader: {
    marginBottom: 20,
  },
  title: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  iconContainer: {
    backgroundColor: "rgba(42, 157, 143, 0.1)",
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  statValue: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 6,
    textAlign: "center",
  },
  statValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  lockIcon: {
    marginLeft: 8,
  },
  syncBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#ff9800', // Laranja
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  syncBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Novos estilos para os alertas de consumos negativos
  alertBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#faad14',
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertContainer: {
    marginTop: 16,
    marginHorizontal: 12,
    padding: 10,
    backgroundColor: '#fffbe6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffe58f',
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    color: '#815500',
  },
});

export default LeituraCard;