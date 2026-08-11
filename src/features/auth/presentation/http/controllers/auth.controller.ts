import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginInputDto } from '../../../application/dto/login-input.dto';
import {
  LoginCompanyChoiceResponse,
  LoginSessionResponse,
} from '../../../application/types/login.type';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { ApiLogin } from '../../../decorators/api-auth.decorator';
import { LoginDto } from '../dto/login.dto';

/**
 * Controller de autenticação — `POST /auth/login`.
 *
 * Magro (AGENTS.md): valida o DTO de apresentação, converte para o DTO de
 * aplicação e delega ao use case. Sem lógica de negócio aqui.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  /**
   * Autentica o usuário e devolve a sessão (ou a lista de empresas).
   *
   * @param dto Credenciais (email, senha) e empresa escolhida (opcional).
   * @returns Sessão JWT ou `requiresCompanyChoice` (multi-empresa).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiLogin()
  public async login(
    @Body() dto: LoginDto,
  ): Promise<LoginSessionResponse | LoginCompanyChoiceResponse> {
    return this.loginUseCase.execute(
      new LoginInputDto(dto.email, dto.password, dto.companyId),
    );
  }
}
