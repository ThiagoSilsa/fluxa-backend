// Constants
import { AccessRequestStatus } from '../../domain/constants/access-request.constant';

// Util
import {
  ACCESS_REQUEST_IN_CONTACT_DEADLINE_DAYS,
  ACCESS_REQUEST_PENDING_DEADLINE_DAYS,
  resolveAccessRequestDeadline,
} from '../../application/utils/access-request-deadline.util';

describe('resolveAccessRequestDeadline', () => {
  const requestedAt = new Date('2026-09-01T12:00:00.000Z');

  /** Data de referência a N dias da solicitação. */
  const daysAfter = (days: number) =>
    new Date(requestedAt.getTime() + days * 24 * 60 * 60 * 1000);

  it('PENDING dentro do prazo (regra 38) não está vencida', () => {
    const result = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.PENDING,
      daysAfter(2),
    );

    expect(result.isOverdue).toBe(false);
    expect(result.daysSinceRequest).toBe(2);
    expect(result.deadline?.toISOString()).toBe('2026-09-04T12:00:00.000Z');
  });

  it('PENDING exatamente no limite ainda não está vencida', () => {
    const result = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.PENDING,
      daysAfter(ACCESS_REQUEST_PENDING_DEADLINE_DAYS),
    );

    expect(result.isOverdue).toBe(false);
  });

  it('PENDING acima de 3 dias vence (regra 38)', () => {
    const result = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.PENDING,
      daysAfter(4),
    );

    expect(result.isOverdue).toBe(true);
    expect(result.daysSinceRequest).toBe(4);
  });

  it('IN_CONTACT estende o prazo até o teto de 7 dias (regra 39)', () => {
    const withinContact = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.IN_CONTACT,
      daysAfter(5),
    );
    const beyondCeiling = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.IN_CONTACT,
      daysAfter(8),
    );

    expect(withinContact.isOverdue).toBe(false);
    expect(withinContact.deadline?.toISOString()).toBe(
      '2026-09-08T12:00:00.000Z',
    );
    expect(ACCESS_REQUEST_IN_CONTACT_DEADLINE_DAYS).toBe(7);
    expect(beyondCeiling.isOverdue).toBe(true);
  });

  it.each([
    AccessRequestStatus.REGISTERED,
    AccessRequestStatus.REJECTED,
    AccessRequestStatus.CANCELLED,
  ])('%s não tem prazo (nunca vence)', (status) => {
    const result = resolveAccessRequestDeadline(
      requestedAt,
      status,
      daysAfter(30),
    );

    expect(result.deadline).toBeNull();
    expect(result.isOverdue).toBe(false);
    expect(result.daysSinceRequest).toBe(30);
  });

  it('data no futuro não produz dias negativos', () => {
    const result = resolveAccessRequestDeadline(
      requestedAt,
      AccessRequestStatus.PENDING,
      new Date('2026-08-30T12:00:00.000Z'),
    );

    expect(result.daysSinceRequest).toBe(0);
  });
});
