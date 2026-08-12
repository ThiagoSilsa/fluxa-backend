// NestJS
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Shared
import { JwtTokenSignUseCase } from '../../../../shared/security/jwt-token-sign.use-case';

// Events
import { UserCompanySwitchedEvent } from '../events/user-company-switched.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';

// Repository
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';

// DTO
import { SwitchCompanyInputDto } from '../dto/switch-company-input.dto';

// Types
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import type { LoginSessionResponse } from '../types/login.type';

// Utils
import { parseExpiresInToSeconds } from '../utils/jwt-expires-in.util';

/**
 * Troca a empresa da sessão **sem repetir senha** (ADR 0002).
 *
 * Quem já tem sessão válida já provou a credencial. O vínculo é conferido na
 * emissão (`findUserInCompany` ativo) — um `companyId` "chutado" é recusado
 * mesmo que a tela nunca o ofereça. Emite token novo com o novo `companyId`.
 */
@Injectable()
export class SwitchCompanyUseCase {
  private readonly logger = new Logger(SwitchCompanyUseCase.name);

  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtTokenSign: JwtTokenSignUseCase,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Emite uma nova sessão para a empresa escolhida.
   *
   * @param actor Ator autenticado (sessão atual).
   * @param input Empresa de destino.
   * @returns Nova sessão JWT com o novo `companyId`.
   * @throws {UnauthorizedException} Quando não há vínculo ativo com a empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: SwitchCompanyInputDto,
  ): Promise<LoginSessionResponse> {
    const candidate = await this.authRepository.findUserInCompany(
      actor.id,
      input.companyId,
    );
    if (!candidate || !candidate.isActive || !candidate.companyIsActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const accessToken = await this.jwtTokenSign.execute({
      sub: candidate.id,
      companyId: candidate.companyId,
      email: candidate.email,
    });

    // Eventos de sessão (ADR 0003) — emissão não bloqueia a resposta.
    this.eventEmitter.emit(
      UserCompanySwitchedEvent.eventName,
      new UserCompanySwitchedEvent(
        actor.id,
        actor.companyId,
        candidate.companyId,
      ),
    );
    this.eventEmitter.emit(
      UserLoggedInEvent.eventName,
      new UserLoggedInEvent(candidate.id, candidate.companyId),
    );

    const expiresInRaw =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '28800s';

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: parseExpiresInToSeconds(expiresInRaw),
      user: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        type: candidate.type,
      },
    };
  }
}
