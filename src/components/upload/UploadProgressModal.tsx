// src/components/upload/UploadProgressModal.tsx
// Modal de progresso para upload manual de leituras e imagens
// VERSÃO 2: Mostra resumo antes de iniciar upload

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UploadProgress } from '../../services/UploadService';

interface Props {
  visible: boolean;
  progress: UploadProgress;
  onClose: () => void;
  onStartUpload?: () => void; // Callback quando usuário confirmar início
}

const UploadProgressModal: React.FC<Props> = ({ visible, progress, onClose, onStartUpload }) => {
  const { 
    leiturasTotal, leiturasEnviadas, leiturasComErro,
    imagensTotal, imagensEnviadas, imagensComErro,
    observacoesTotal, observacoesEnviadas, observacoesComErro,
    comentariosTotal, comentariosEnviados, comentariosComErro,
    status 
  } = progress;

  const totalItens = leiturasTotal + imagensTotal + observacoesTotal + comentariosTotal;
  const itensEnviados = leiturasEnviadas + imagensEnviadas + observacoesEnviadas + comentariosEnviados;
  const itensComErro = leiturasComErro + imagensComErro + observacoesComErro + comentariosComErro;
  const percentual = totalItens > 0 ? Math.round((itensEnviados / totalItens) * 100) : 0;

  const isIdle = status === 'idle';
  const isUploading = status === 'uploading';
  const isCompleted = status === 'completed';
  const hasErrors = itensComErro > 0;

  // TELA DE RESUMO (antes de iniciar)
  if (isIdle && totalItens > 0) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Botão X no topo (canto direito) */}
            <TouchableOpacity style={styles.closeIconButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-upload-outline" size={40} color="#2a9d8f" />
              </View>
              <Text style={styles.title}>Pronto para enviar</Text>
              <Text style={styles.subtitle}>
                Confira o resumo dos dados que serão enviados
              </Text>
            </View>

            {/* Resumo */}
            <View style={styles.details}>
              {/* Total de itens */}
              <View style={[styles.detailRow, styles.totalRow]}>
                <View style={styles.detailLabel}>
                  <Ionicons name="cube-outline" size={24} color="#2a9d8f" />
                  <Text style={[styles.detailText, styles.totalText]}>Total de itens</Text>
                </View>
                <Text style={[styles.detailValue, styles.totalValue]}>
                  {totalItens}
                </Text>
              </View>

              {/* Leituras */}
              {leiturasTotal > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="document-text-outline" size={20} color="#2a9d8f" />
                    <Text style={styles.detailText}>Leituras pendentes</Text>
                  </View>
                  <Text style={styles.detailValue}>{leiturasTotal}</Text>
                </View>
              )}

              {/* Imagens */}
              {imagensTotal > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="image-outline" size={20} color="#4d97a3" />
                    <Text style={styles.detailText}>Imagens pendentes</Text>
                  </View>
                  <Text style={styles.detailValue}>{imagensTotal}</Text>
                </View>
              )}

              {/* Observações */}
              {observacoesTotal > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#faad14" />
                    <Text style={styles.detailText}>Observações pendentes</Text>
                  </View>
                  <Text style={styles.detailValue}>{observacoesTotal}</Text>
                </View>
              )}

              {/* Comentários */}
              {comentariosTotal > 0 && (
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="chatbox-outline" size={20} color="#1890ff" />
                    <Text style={styles.detailText}>Comentários pendentes</Text>
                  </View>
                  <Text style={styles.detailValue}>{comentariosTotal}</Text>
                </View>
              )}
            </View>

            {/* Botões */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.startButton}
                onPress={onStartUpload}
              >
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.startButtonText}>Iniciar Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // TELA DE PROGRESSO (durante upload)
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isCompleted ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Botão X no topo (apenas quando completo) */}
          {isCompleted && (
            <TouchableOpacity style={styles.closeIconButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          )}

          {/* Header */}
          <View style={styles.header}>
            {isCompleted ? (
              <View style={[styles.iconCircle, styles.successCircle]}>
                <Ionicons name="checkmark-circle" size={48} color="#52c41a" />
              </View>
            ) : (
              <ActivityIndicator size="large" color="#2a9d8f" />
            )}
            <Text style={styles.title}>
              {isCompleted ? 'Concluído!' : 'Enviando dados...'}
            </Text>
            {!isCompleted && (
              <Text style={styles.subtitle}>
                Aguarde enquanto seus dados são enviados
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${percentual}%` }]} />
              </View>
              <Text style={styles.progressText}>{percentual}%</Text>
            </View>
          )}

          {/* Details */}
          <View style={styles.details}>
            {/* Leituras */}
            {leiturasTotal > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="document-text-outline" size={20} color="#2a9d8f" />
                  <Text style={styles.detailText}>Leituras</Text>
                </View>
                <Text style={styles.detailValue}>
                  {leiturasEnviadas}/{leiturasTotal}
                </Text>
              </View>
            )}

            {/* Imagens */}
            {imagensTotal > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="image-outline" size={20} color="#4d97a3" />
                  <Text style={styles.detailText}>Imagens</Text>
                </View>
                <Text style={styles.detailValue}>
                  {imagensEnviadas}/{imagensTotal}
                </Text>
              </View>
            )}

            {/* Observações */}
            {observacoesTotal > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#faad14" />
                  <Text style={styles.detailText}>Observações</Text>
                </View>
                <Text style={styles.detailValue}>
                  {observacoesEnviadas}/{observacoesTotal}
                </Text>
              </View>
            )}

            {/* Comentários */}
            {comentariosTotal > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabel}>
                  <Ionicons name="chatbox-outline" size={20} color="#1890ff" />
                  <Text style={styles.detailText}>Comentários</Text>
                </View>
                <Text style={styles.detailValue}>
                  {comentariosEnviados}/{comentariosTotal}
                </Text>
              </View>
            )}

            {/* Erros (se houver) */}
            {hasErrors && (
              <View style={[styles.detailRow, styles.errorRow]}>
                <View style={styles.detailLabel}>
                  <Ionicons name="alert-circle-outline" size={20} color="#ff4d4f" />
                  <Text style={[styles.detailText, styles.errorText]}>Com erro</Text>
                </View>
                <Text style={[styles.detailValue, styles.errorText]}>
                  {itensComErro}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          {isCompleted && (
            <View style={styles.completedFooter}>
              {/* Mensagem de sucesso/erro */}
              <View style={[styles.messageBox, hasErrors ? styles.warningBox : styles.successBox]}>
                <Ionicons
                  name={hasErrors ? "alert-circle" : "checkmark-circle"}
                  size={20}
                  color={hasErrors ? "#faad14" : "#52c41a"}
                />
                <Text style={[styles.messageText, hasErrors ? styles.warningText : styles.successText]}>
                  {hasErrors
                    ? `${itensEnviados} ${itensEnviados === 1 ? 'item enviado' : 'itens enviados'}, ${itensComErro} com erro`
                    : `Todos os itens foram enviados com sucesso!`}
                </Text>
              </View>

              {/* Botão Fechar */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  closeIconButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e6f7f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCircle: {
    backgroundColor: '#f6ffed',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2a9d8f',
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#2a9d8f',
  },
  details: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    marginBottom: 10,
  },
  totalRow: {
    backgroundColor: '#e6f7f5',
    borderWidth: 1,
    borderColor: '#2a9d8f',
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 15,
    color: '#666',
    marginLeft: 10,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2a9d8f',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2a9d8f',
  },
  errorRow: {
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#ffccc7',
  },
  errorText: {
    color: '#ff4d4f',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  completedFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
    marginTop: 4,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  warningBox: {
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    lineHeight: 20,
  },
  successText: {
    color: '#389e0d',
  },
  warningText: {
    color: '#d48806',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d9d9d9',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#595959',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    flex: 1,
    backgroundColor: '#2a9d8f',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  closeButton: {
    backgroundColor: '#2a9d8f',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#2a9d8f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UploadProgressModal;
