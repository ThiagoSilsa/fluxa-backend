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
import { PasswordVerifyUseCase } from '../../../../shared/security/password-verify.use-case';

// Events
import { UserLoggedInEvent } from '../events/user-logged-in.event';

// Repository
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';

// DTO
import { LoginInputDto } from '../dto/login-input.dto';

// Types
import type { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import type { AuthRepository } from '../../domain/repositories/auth.repository';
import type {
  LoginCompanyChoiceResponse,
  LoginCompanyOption,
  LoginSessionResponse,
  ResolveChosenResult,
} from '../types/login.type';

// Utils
import { parseExpiresInToSeconds } from '../utils/jwt-expires-in.util';

/**
 * Use case de login multi-empresa (ADR 0002).
 *
 * Fluxo:
 * 1. `findUsersByEmail` → candidatos (1 por vínculo ativo + empresa ativa);
 * 2. verifica a senha (o hash é da pessoa — email único global);
 * 3. `resolveChosen` decide a empresa:
 *    - `companyId` informado → usa aquela empresa (senão 401 idêntico);
 *    - **1 candidato → entra direto**;
 *    - **N candidatos sem escolha → `requiresCompanyChoice`** com a lista
 *      (exposta apenas depois de a senha conferir);
 * 4. registra `last_login_at` (ADR 0003) — **falha não bloqueia** a sessão;
 * 5. assina o JWT `{ sub, companyId, email }` da sessão.
 *
 * Todas as falhas devolvem o mesmo 401 (respostas indistinguíveis).
 */
@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly passwordVerify: PasswordVerifyUseCase,
    private readonly jwtTokenSign: JwtTokenSignUseCase,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Autentica a pessoa e devolve a sessão (ou a lista de empresas).
   *
   * @param input Credenciais (email, senha) e empresa escolhida (opcional).
   * @returns Sessão JWT quando a empresa é única/escolhida; senão a lista de
   * empresas para escolha.
   * @throws {UnauthorizedException} Senha errada, sem candidato ativo ou
   * `companyId` sem vínculo.
   */
  public async execute(
    input: LoginInputDto,
  ): Promise<LoginSessionResponse | LoginCompanyChoiceResponse> {
    const candidates = (
      await this.authRepository.findUsersByEmail(input.email)
    ).filter((candidate) => candidate.isActive && candidate.companyIsActive);

    if (candidates.length === 0) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // O hash é da pessoa (email único global) — verificar uma vez é suficiente.
    const passwordOk = this.passwordVerify.execute(
      input.password,
      candidates[0].passwordHash,
    );
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const resolved = this.resolveChosen(candidates, input.companyId);
    if (resolved.type === 'choice') {
      return {
        requiresCompanyChoice: true,
        companies: resolved.companies,
      };
    }

    const candidate = resolved.candidate;

    // Registra o último login — falha não bloqueia a sessão (ADR 0003).
    try {
      await this.authRepository.updateLastLoginAt(candidate.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.warn(
        `Falha ao registrar last_login_at do usuário ${candidate.id}: ${message}`,
      );
    }

    const accessToken = await this.jwtTokenSign.execute({
      sub: candidate.id,
      companyId: candidate.companyId,
      email: candidate.email,
    });

    // Evento de sessão (ADR 0003) — emissão não bloqueia a resposta.
    this.eventEmitter.emit(
      UserLoggedInEvent.eventName,
      new UserLoggedInEvent(
        candidate.id,
        candidate.companyId,
        input.ipAddress,
        input.userAgent,
      ),
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

  /**
   * Decide a empresa da sessão (ADR 0002).
   *
   * @param candidates Candidatos ativos (1 por vínculo).
   * @param companyId Empresa escolhida no body (opcional).
   * @returns Candidato escolhido ou a lista de empresas para escolha.
   * @throws {UnauthorizedException} Quando o `companyId` não corresponde a
   * nenhum vínculo (indistinguível de senha errada).
   */
  private resolveChosen(
    candidates: AuthUserEntity[],
    companyId?: string,
  ): ResolveChosenResult {
    if (companyId) {
      const match = candidates.find(
        (candidate) => candidate.companyId === companyId,
      );
      if (!match) {
        throw new UnauthorizedException('Credenciais inválidas.');
      }
      return { type: 'chosen', candidate: match };
    }

    if (candidates.length === 1) {
      return { type: 'chosen', candidate: candidates[0] };
    }

    const companies: LoginCompanyOption[] = candidates.map((candidate) => ({
      id: candidate.companyId,
      name: candidate.companyName,
    }));
    return { type: 'choice', companies };
  }
}
