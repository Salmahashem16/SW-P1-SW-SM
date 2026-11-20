import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { clearAuthCookies } from '../auth/auth.cookies';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toPublicUser } from './user.mapper';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the logged-in user profile (ACC-11)' })
  async getMe(@CurrentUser() currentUser: AuthUser) {
    const user = await this.usersService.findById(currentUser.userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user: toPublicUser(user) };
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Edit name, phone number and preferred currency (ACC-09)',
  })
  async updateMe(
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(
      currentUser.userId,
      dto,
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Profile updated', user: toPublicUser(user) };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate my own account (ACC-12)' })
  async deactivateMe(
    @CurrentUser() currentUser: AuthUser,
    @Body() dto: DeactivateAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.usersService.deactivateOwnAccount(
      currentUser.userId,
      dto.password,
    );

    clearAuthCookies(res);
    return result;
  }
}
