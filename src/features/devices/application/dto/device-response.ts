// Constants
import type { DevicePlatform } from '../../domain/constants/device-platform.constant';

// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Resumo da portaria vinculada ao dispositivo (detalhe/listagem).
 */
export interface DeviceEntranceSummary {
  /** Id da portaria. */
  id: string;
  /** Nome da portaria. */
  name: string;
}

/**
 * Dispositivo no formato de resposta (nunca a entidade crua do banco —
 * AGENTS.md §3). **O token nunca aparece** (write-only — ADR 0008 §3);
 * `platform` é imutável e `appVersion`/`lastSyncAt` são somente leitura
 * (preenchidos pelo app — ADR 0008 §7).
 */
export interface DeviceResponse {
  /** Id do dispositivo. */
  id: string;
  /** Identificação amigável (ex.: `Tablet Portaria 1`). */
  name: string;
  /** Plataforma do aparelho (imutável). */
  platform: DevicePlatform;
  /** Versão do app (somente leitura). */
  appVersion: string | null;
  /** Id da portaria vinculada (ou null). */
  entranceId: string | null;
  /** Portaria vinculada (resumo) ou null. */
  entrance: DeviceEntranceSummary | null;
  /** Última sincronização (somente leitura) ou null. */
  lastSyncAt: string | null;
  /** Se o dispositivo está ativo. */
  isActive: boolean;
  /** Data de criação (ISO). */
  createdAt: string;
  /** Data da última atualização (ISO). */
  updatedAt: string;
}

/**
 * Resposta de criação/rotação de token — o token é devolvido **uma única
 * vez** nesta resposta (write-only — ADR 0008 §3).
 */
export interface DeviceWithTokenResponse {
  /** Dispositivo (sem o token). */
  device: DeviceResponse;
  /** Token de sync (exibido apenas aqui). */
  token: string;
}

/**
 * Resposta paginada de dispositivos — formato padrão do AGENTS.md §3 (`limit`,
 * `offset`, `data`, `count`, `parameters?`).
 */
export interface ListDevicesResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: DeviceResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros (portarias ativas — ADR 0008 §5). */
  parameters?: ParameterDto[];
}
