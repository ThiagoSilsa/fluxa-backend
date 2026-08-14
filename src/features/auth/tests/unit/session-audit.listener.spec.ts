// NestJS
import { Logger } from '@nestjs/common';

// Events
import { UserCompanySwitchedEvent } from '../../application/events/user-company-switched.event';
import { UserLoggedInEvent } from '../../application/events/user-logged-in.event';

// Infrastructure
import { SessionAuditListener } from '../../infrastructure/listeners/session-audit.listener';

/**
 * Testes unitários do `SessionAuditListener` (ADR 0003).
 *
 * Por ora o listener apenas registra os eventos no log — a persistência
 * (`audit_log`, ação `LOGIN`) chega com a migration `0007` (auditoria). Os
 * testes confirmam a fiação: cada handler loga os dados do evento sem lançar.
 */
describe('SessionAuditListener', () => {
  let listener: SessionAuditListener;
  let logSpy: jest.SpyInstance;

  const USER_ID = '30000000-0000-0000-0000-000000000001';
  const SOMAR_COMPANY_ID = '10000000-0000-0000-0000-000000000001';
  const SECOND_COMPANY_ID = '20000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    listener = new SessionAuditListener();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('loga o login com user, company e contexto (ip/userAgent)', () => {
    listener.handleLoggedIn(
      new UserLoggedInEvent(
        USER_ID,
        SOMAR_COMPANY_ID,
        '10.0.0.1',
        'jest-agent',
      ),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`user=${USER_ID}`),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`company=${SOMAR_COMPANY_ID}`),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ip=10.0.0.1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('jest-agent'));
  });

  it('loga o login com ip/userAgent ausentes como "-"', () => {
    listener.handleLoggedIn(new UserLoggedInEvent(USER_ID, SOMAR_COMPANY_ID));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ip=-'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('userAgent=-'));
  });

  it('loga a troca de empresa com from → to', () => {
    listener.handleCompanySwitched(
      new UserCompanySwitchedEvent(
        USER_ID,
        SOMAR_COMPANY_ID,
        SECOND_COMPANY_ID,
      ),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SOMAR_COMPANY_ID),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(SECOND_COMPANY_ID),
    );
  });
});
