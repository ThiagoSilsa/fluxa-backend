import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import { LoginInputDto } from '../../../application/dto/login-input.dto';
import { SwitchCompanyInputDto } from '../../../application/dto/switch-company-input.dto';
import { AuthCompanyEntity } from '../../../domain/entities/auth-company.entity';
import { AuthenticatedUserEntity } from '../../../domain/entities/authenticated-user.entity';
import {
  LoginCompanyChoiceResponse,
  LoginSessionResponse,
} from '../../../application/types/login.type';
import { ListSessionCompaniesUseCase } from '../../../application/use-cases/list-session-companies.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { SwitchCompanyUseCase } from '../../../application/use-cases/switch-company.use-case';
import {
  ApiListSessionCompanies,
  ApiLogin,
  ApiSwitchCompany,
  ApiValidateToken,
} from '../../../decorators/api-auth.decorator';
import { LoginDto } from '../dto/login.dto';
import { SwitchCompanyDto } from '../dto/switch-company.dto';
import { ThrottleLogin } from '../../../../../shared/throttler/throttle-login.decorator';
import type { ValidateSessionResponse } from '../../../application/types/login.type';
import { ValidateSessionUseCase } from '../../../application/use-cases/validate-session.use-case';

/**
 * Controller de autenticação.
 *
 * Magro (AGENTS.md): valida o DTO de apresentação, converte para o DTO de
 * aplicação e delega ao use case. Sem lógica de negócio aqui.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly listSessionCompaniesUseCase: ListSessionCompaniesUseCase,
    private readonly switchCompanyUseCase: SwitchCompanyUseCase,
    private readonly validateSessionUseCase: ValidateSessionUseCase,
  ) {}

  /**
   * Autentica o usuário e devolve a sessão (ou a lista de empresas).
   *
   * Rota pública protegida por rate limiting (ADR 0003): 20 tentativas/min
   * por IP e 10/min por e-mail, com 429 genérico no excesso. Captura o
   * contexto da sessão (`ip`/`user-agent`) do request — ADR 0003.
   *
   * @param request Request HTTP (para IP e user-agent).
   * @param dto Credenciais (email, senha) e empresa escolhida (opcional).
   * @returns Sessão JWT ou `requiresCompanyChoice` (multi-empresa).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ThrottleLogin()
  @ApiLogin()
  public async login(
    @Req() request: Request,
    @Body() dto: LoginDto,
  ): Promise<LoginSessionResponse | LoginCompanyChoiceResponse> {
    return this.loginUseCase.execute(
      new LoginInputDto(
        dto.email,
        dto.password,
        dto.companyId,
        this.extractIp(request),
        this.extractUserAgent(request),
      ),
    );
  }

  /**
   * Extrai o IP de origem do request (ADR 0003 — contexto de sessão).
   *
   * @param request Request HTTP.
   * @returns IP limitado a 45 caracteres (alinhado ao `@MaxLength(45)` do
   * DTO) ou `undefined` quando ausente.
   */
  private extractIp(request: Request): string | undefined {
    const ip = request.ip;
    return ip ? ip.slice(0, 45) : undefined;
  }

  /**
   * Extrai o User-Agent do request (ADR 0003 — contexto de sessão).
   *
   * @param request Request HTTP.
   * @returns User-Agent limitado a 500 caracteres (alinhado ao
   * `@MaxLength(500)` do DTO) ou `undefined` quando ausente.
   */
  private extractUserAgent(request: Request): string | undefined {
    const userAgent = request.headers['user-agent'];
    return typeof userAgent === 'string' ? userAgent.slice(0, 500) : undefined;
  }

  /**
   * Lista as empresas que a pessoa pode abrir (seletor do frontend).
   *
   * @param request Requisição autenticada (guarda o ator em `request.user`).
   * @returns Empresas ativas da pessoa.
   */
  @Get('companies')
  @UseGuards(JwtAuthGuard)
  @ApiListSessionCompanies()
  public async listSessionCompanies(
    @Req() request: AuthenticatedRequest,
  ): Promise<AuthCompanyEntity[]> {
    return this.listSessionCompaniesUseCase.execute(this.requireUser(request));
  }

  /**
   * Valida a sessão atual e devolve o ator (boot do frontend — ADR 0003).
   *
   * O `JwtAuthGuard` revalida o vínculo pessoa+empresa a cada requisição.
   *
   * @param request Requisição autenticada.
   * @returns Dados da sessão (pessoa, empresa, cargos e permissões).
   */
  @Get('validate')
  @UseGuards(JwtAuthGuard)
  @ApiValidateToken()
  public validateSession(
    @Req() request: AuthenticatedRequest,
  ): ValidateSessionResponse {
    return this.validateSessionUseCase.execute(this.requireUser(request));
  }

  /**
   * Troca a empresa da sessão sem repetir senha.
   *
   * @param request Requisição autenticada.
   * @param dto Empresa de destino.
   * @returns Nova sessão JWT para a empresa escolhida.
   */
  @Post('switch-company')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiSwitchCompany()
  public async switchCompany(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SwitchCompanyDto,
  ): Promise<LoginSessionResponse> {
    return this.switchCompanyUseCase.execute(
      this.requireUser(request),
      new SwitchCompanyInputDto(dto.companyId),
    );
  }

  /**
   * Obtém o ator autenticado do request (populado pelo `JwtAuthGuard`).
   *
   * @param request Requisição autenticada.
   * @returns Ator autenticado.
   * @throws {UnauthorizedException} Sem ator no request.
   */
  private requireUser(request: AuthenticatedRequest): AuthenticatedUserEntity {
    if (!request.user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return request.user;
  }
}
