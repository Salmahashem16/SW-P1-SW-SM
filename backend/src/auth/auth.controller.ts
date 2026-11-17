import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import {
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  setAuthCookies,
} from './auth.cookies';
import { AuthService } from './auth.service';
import type { AuthUser, RequestWithCookies } from './auth.types';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (ACC-01)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in and receive authentication cookies (ACC-04, ACC-05)',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    setAuthCookies(res, result);

    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the authentication cookies (ACC-19)' })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(
      req.cookies?.[REFRESH_COOKIE_NAME],
    );

    setAuthCookies(res, result);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log out, revoke the refresh token and clear cookies (ACC-06)',
  })
  async logout(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(
      req.cookies?.[REFRESH_COOKIE_NAME],
    );

    clearAuthCookies(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get the current user from the database (ACC-19)' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.getCurrentUser(user.userId);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Change the current user password (ACC-08)' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.userId, dto);

    clearAuthCookies(res);
    return result;
  }
}
