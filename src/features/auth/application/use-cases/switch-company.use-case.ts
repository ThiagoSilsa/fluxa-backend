import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtTokenSignUseCase } from '../../../../shared/security/jwt-token-sign.use-case';
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import { SwitchCompanyInputDto } from '../dto/switch-company-input.dto';
import { LoginSessionResponse } from '../types/login.type';
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
