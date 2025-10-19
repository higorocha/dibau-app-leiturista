// src/database/models/ObservacaoComentario.ts
import { Model } from '@nozbe/watermelondb';
import { field, readonly, date, relation, immutableRelation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import type Observacao from './Observacao';

/**
 * Status de sincronização
 */
export type SyncStatus = 'synced' | 'local_edited' | 'uploading' | 'error';

/**
 * Interface para os dados de um comentário de observação
 */
export interface ObservacaoComentarioData {
  serverId?: number;
  observacaoId: string; // WatermelonDB ID da observação local
  observacaoServerId: number; // ID da observação no servidor
  comentario: string;
  usuarioId: number;
  usuarioNome?: string;
  syncStatus: SyncStatus;
  syncedAt?: Date;
  errorMessage?: string;
}

/**
 * Model para Comentários de Observações
 * Armazena comentários adicionados a observações offline que serão sincronizados com o servidor
 */
export default class ObservacaoComentario extends Model {
  static table = 'observacoes_comentarios';
  static associations = {
    observacoes: { type: 'belongs_to' as const, key: 'observacao_id' }
  };

  // ===== CAMPOS DO SERVIDOR =====
  @field('server_id') serverId!: number;
  @field('observacao_server_id') observacaoServerId!: number;
  @field('comentario') comentario!: string;

  // ===== DADOS DO USUÁRIO =====
  @field('usuario_id') usuarioId!: number;
  @field('usuario_nome') usuarioNome?: string;

  // ===== FLAGS DE SINCRONIZAÇÃO =====
  @field('sync_status') syncStatus!: SyncStatus;
  @date('synced_at') syncedAt?: Date;
  @field('error_message') errorMessage?: string;

  // ===== METADADOS =====
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ===== RELAÇÕES =====
  @immutableRelation('observacoes', 'observacao_id') observacao!: Relation<Observacao>;

  // ===== MÉTODOS AUXILIARES =====

  /**
   * Verifica se o comentário está sincronizado
   */
  get isSynced(): boolean {
    return this.syncStatus === 'synced';
  }

  /**
   * Verifica se o comentário tem erro de sincronização
   */
  get hasError(): boolean {
    return this.syncStatus === 'error';
  }

  /**
   * Verifica se o comentário foi editado localmente
   */
  get isLocalEdited(): boolean {
    return this.syncStatus === 'local_edited';
  }

  /**
   * Verifica se o comentário está em processo de upload
   */
  get isUploading(): boolean {
    return this.syncStatus === 'uploading';
  }

  /**
   * Formata a data de criação para exibição
   */
  get formattedCreatedAt(): string {
    return this.createdAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
