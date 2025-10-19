import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogCategory = 'auth' | 'api' | 'sync' | 'upload' | 'general';
export type LogSyncStatus = 'pending' | 'uploading' | 'synced' | 'error';

export default class Log extends Model {
  static table = 'logs';

  @field('level') level!: LogLevel;
  @field('category') category!: LogCategory;
  @field('message') message!: string;
  @field('details') details?: string;
  @field('device_info') deviceInfo?: string;
  @field('app_version') appVersion?: string;
  @field('user_email') userEmail?: string;

  @field('sync_status') syncStatus!: LogSyncStatus;
  @field('error_message') errorMessage?: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
