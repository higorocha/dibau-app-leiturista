import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type SyncStatus = 'synced' | 'local_edited' | 'uploading' | 'error';

export default class Leitura extends Model {
  static table = 'leituras';

  // ✅ IDENTIFICAÇÃO
  @field('server_id') serverId!: number; // ID da fatura no servidor
  @field('leitura_backend_id') leituraBackendId?: number; // ✅ ID da leitura no backend (para upload de imagem)
  @field('mes_referencia') mesReferencia!: string;
  @field('ano_referencia') anoReferencia!: number;

  // ✅ DADOS ESSENCIAIS PARA EXIBIÇÃO NA TELA
  @field('lote_id') loteId!: number; // ✅ ID do lote no servidor (para vincular com observações)
  @field('lote_nome') loteNome!: string; // NECESSÁRIO para exibição
  @field('lote_situacao') loteSituacao!: string; // "Operacional" ou "Abandonado"
  @field('lote_mapa_leitura') loteMapaLeitura?: number; // Número do mapa de leitura
  @field('irrigante_nome') irriganteNome!: string; // NECESSÁRIO para exibição
  @field('hidrometro_codigo') hidrometroCodigo!: string; // NECESSÁRIO para exibição
  @field('hidrometro_x10') hidrometroX10!: boolean; // NECESSÁRIO - FLAG CRÍTICA!

  // ✅ DADOS ESSENCIAIS PARA UPLOAD
  @field('leitura_atual') leituraAtual!: number;
  @field('data_leitura') dataLeitura?: string;

  // ✅ DADOS PARA EXIBIÇÃO/COMPARAÇÃO
  @field('leitura_anterior') leituraAnterior!: number;
  @field('data_leitura_anterior') dataLeituraAnterior?: string;
  @field('consumo') consumo!: number;
  @field('valor_leitura_m3') valorLeituraM3!: number;
  @field('imagem_url') imagemUrl?: string;
  
  // ✅ CAMPOS DE ESTADO/STATUS
  @field('fechada') fechada!: string;
  @field('status') status!: string;

  // ✅ CONTROLE DE SINCRONIZAÇÃO
  @field('sync_status') syncStatus!: SyncStatus;
  @field('has_local_image') hasLocalImage!: boolean;
  @field('last_sync_at') lastSyncAt?: number;
  @field('error_message') errorMessage?: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
