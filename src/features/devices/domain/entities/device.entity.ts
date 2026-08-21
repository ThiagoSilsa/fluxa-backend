// Constants
import type { DevicePlatform } from '../constants/device-platform.constant';

/**
 * Dispositivo do app do porteiro (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `device` (migration `0005`; ADR 0008). Tablet/celular
 * **compartilhado** (sem `user_id` — decisão do planejamento-geral): vários
 * porteiros logam no mesmo aparelho. O `token` é o identificador de sync
 * (semana 3+), **write-only** — nunca aparece nas respostas.
 */
export interface DeviceEntity {
  /** Id do dispositivo. */
  id: string;
  /** Empresa dona do dispositivo. */
  companyId: string;
  /** Identificação amigável (ex.: `Tablet Portaria 1`). */
  name: string;
  /** Token de sync (write-only — ADR 0008 §3). */
  token: string;
  /** Plataforma do aparelho (imutável após a criação). */
  platform: DevicePlatform;
  /** Versão do app (preenchida pelo app — somente leitura na web). */
  appVersion: string | null;
  /** Portaria vinculada (opcional — preenche `entrance_id` dos eventos). */
  entranceId: string | null;
  /** Última sincronização (preenchida pelo app — somente leitura na web). */
  lastSyncAt: Date | null;
  /** Se o dispositivo está ativo (desativado → token deixa de valer). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}

/**
 * Dispositivo com a portaria agregada — usado nas respostas de
 * detalhe/listagem (resumo `{ id, name }`).
 */
export interface DeviceWithEntranceEntity extends DeviceEntity {
  /** Portaria vinculada (resumo) ou `null` se não vinculado. */
  entrance: { id: string; name: string } | null;
}
