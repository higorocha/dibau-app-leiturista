// src/database/models/Observacao.ts
import { Model } from '@nozbe/watermelondb';
import { field, readonly, date, children } from '@nozbe/watermelondb/decorators';
import type { Relation, Query } from '@nozbe/watermelondb';
import type ObservacaoComentario from './ObservacaoComentario';

/**
 * Status de sincronização
 */
export type SyncStatus = 'synced' | 'local_edited' | 'uploading' | 'error';

/**
 * Tipos de observação
 */
export type TipoObservacao = 'pendencia' | 'vistoria' | 'outros';

/**
 * Status da observação
 */
export type StatusObservacao = 'vigente' | 'finalizada';

/**
 * Interface para os dados de uma observação
 */
export interface ObservacaoData {
  serverId?: number;
  loteId: number;
  tipo: TipoObservacao;
  status: StatusObservacao;
  titulo: string;
  descricao?: string;
  usuarioCriadorId: number;
  usuarioCriadorNome?: string;
  usuarioFinalizadorId?: number;
  usuarioFinalizadorNome?: string;
  dataFinalizacao?: Date;
  syncStatus: SyncStatus;
  syncedAt?: Date;
  errorMessage?: string;
}

/**
 * Model para Observações de Lotes
 * Armazena observações criadas offline que serão sincronizadas com o servidor
 */
export default class Observacao extends Model {
  static table = 'observacoes';
  static associations = {
    observacoes_comentarios: { type: 'has_many' as const, foreignKey: 'observacao_id' }
  };

  // ===== CAMPOS DO SERVIDOR =====
  @field('server_id') serverId!: number;
  @field('lote_id') loteId!: number;
  @field('tipo') tipo!: TipoObservacao;
  @field('status') status!: StatusObservacao;
  @field('titulo') titulo!: string;
  @field('descricao') descricao?: string;

  // ===== DADOS DO USUÁRIO CRIADOR =====
  @field('usuario_criador_id') usuarioCriadorId!: number;
  @field('usuario_criador_nome') usuarioCriadorNome?: string;

  // ===== DADOS DO USUÁRIO FINALIZADOR =====
  @field('usuario_finalizador_id') usuarioFinalizadorId?: number;
  @field('usuario_finalizador_nome') usuarioFinalizadorNome?: string;
  @date('data_finalizacao') dataFinalizacao?: Date;

  // ===== FLAGS DE SINCRONIZAÇÃO =====
  @field('sync_status') syncStatus!: SyncStatus;
  @date('synced_at') syncedAt?: Date;
  @field('error_message') errorMessage?: string;

  // ===== METADADOS =====
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ===== RELAÇÕES =====
  @children('observacoes_comentarios') comentarios!: Query<ObservacaoComentario>;

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Verifica se a observação está vigente
   */
  get isVigente(): boolean {
    return this.status === 'vigente';
  }

  /**
   * Verifica se a observação foi finalizada
   */
  get isFinalizada(): boolean {
    return this.status === 'finalizada';
  }

  /**
   * Verifica se a observação está sincronizada
   */
  get isSynced(): boolean {
    return this.syncStatus === 'synced';
  }

  /**
   * Verifica se a observação tem erro de sincronização
   */
  get hasError(): boolean {
    return this.syncStatus === 'error';
  }

  /**
   * Verifica se a observação foi editada localmente
   */
  get isLocalEdited(): boolean {
    return this.syncStatus === 'local_edited';
  }

  /**
   * Verifica se a observação está em processo de upload
   */
  get isUploading(): boolean {
    return this.syncStatus === 'uploading';
  }

  /**
   * Retorna uma descrição legível do tipo
   */
  get tipoLabel(): string {
    const labels: Record<TipoObservacao, string> = {
      pendencia: 'Pendência',
      vistoria: 'Vistoria',
      outros: 'Outros',
    };
    return labels[this.tipo] || this.tipo;
  }

  /**
   * Retorna uma descrição legível do status
   */
  get statusLabel(): string {
    const labels: Record<StatusObservacao, string> = {
      vigente: 'Vigente',
      finalizada: 'Finalizada',
    };
    return labels[this.status] || this.status;
  }
}
