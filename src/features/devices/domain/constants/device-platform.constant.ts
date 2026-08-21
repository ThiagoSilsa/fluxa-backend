/**
 * Plataformas de dispositivo suportadas (enum `device_platform` do Postgres —
 * migration `0005`; ADR 0008 §2). Propriedade física do aparelho: **imutável**
 * após a criação (ADR 0008 §7).
 */
export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}
