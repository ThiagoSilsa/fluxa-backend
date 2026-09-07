/**
 * Cenários de solicitação de acesso (enum `access_request_type` do Postgres —
 * migration `0005`; regra 41).
 *
 * - `NEW_USER` — veículo cadastrado, motorista **não**: o aceite cria `user` +
 *   vínculo (`user_vehicle`) com o veículo existente;
 * - `NEW_VEHICLE` — motorista cadastrado, veículo **não**: o aceite cria
 *   `vehicle` + vínculo com o usuário existente;
 * - `LINK` — ambos cadastrados **sem vínculo**: cria apenas `user_vehicle`;
 * - `BOTH` — nenhum cadastrado: o aceite cria `user` + `vehicle` + vínculo.
 */
export enum AccessRequestType {
  NEW_USER = 'NEW_USER',
  NEW_VEHICLE = 'NEW_VEHICLE',
  LINK = 'LINK',
  BOTH = 'BOTH',
}

/**
 * Status de uma solicitação de acesso (enum `access_request_status` —
 * migration `0005`).
 *
 * - `PENDING` — criada pelo porteiro, aguardando a administração;
 * - `IN_CONTACT` — administração já em contato (estende o prazo do bloqueio
 *   automático — regra 39);
 * - `REGISTERED` — aceita e resolvida (cadastros/vínculo criados);
 * - `REJECTED` — recusada (duplicidade também vira REJECTED — regra 47);
 * - `CANCELLED` — cancelada pelo próprio porteiro (apenas em PENDING).
 */
export enum AccessRequestStatus {
  PENDING = 'PENDING',
  IN_CONTACT = 'IN_CONTACT',
  REGISTERED = 'REGISTERED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Canais de contato do motorista (enum `contact_channel` — migration `0005`).
 */
export enum ContactChannel {
  WHATSAPP = 'WHATSAPP',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
}
