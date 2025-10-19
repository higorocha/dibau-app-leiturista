import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type ImageSyncStatus = 'synced' | 'uploading' | 'error';

export default class Imagem extends Model {
  static table = 'imagens';

  @field('leitura_id') leituraId!: string;
  @field('leitura_server_id') leituraServerId!: number; // ID da fatura no servidor
  @field('leitura_backend_id') leituraBackendId?: number; // ✅ ID da leitura no backend (para upload)
  @field('local_uri') localUri!: string;
  @field('file_size') fileSize!: number;
  @field('mime_type') mimeType!: string;

  @field('sync_status') syncStatus!: ImageSyncStatus;
  @field('uploaded_url') uploadedUrl?: string;
  @field('error_message') errorMessage?: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
