import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateRoomDto,
  RoomDateRangeDto,
  UpdateRoomAvailabilityDto,
  UpdateRoomDto,
} from './dto/room.dto';
import { RoomsService } from './rooms.service';

/** Room management for the hotel's own moderator. */
@ApiTags('Hotel Rooms')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hotels/:id/rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @Roles('hotelModerator')
  @ApiOperation({ summary: 'Add a room (HTL-03)' })
  create(
    @Param('id') id: string,
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.create(user, id, dto);
  }

  @Get()
  @Roles('hotelModerator', 'admin')
  @ApiOperation({
    summary: 'All rooms with availability ranges and blocks (moderator view)',
  })
  list(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rooms.listForManager(user, id);
  }

  @Patch(':roomId')
  @Roles('hotelModerator')
  @ApiOperation({
    summary: 'Edit beds, occupancy, price; isActive=false deactivates (HTL-05, HTL-06)',
  })
  update(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.update(user, id, roomId, dto);
  }

  @Delete(':roomId')
  @Roles('hotelModerator')
  @ApiOperation({ summary: 'Delete a room that was never reserved (HTL-06)' })
  remove(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.remove(user, id, roomId);
  }

  @Post(':roomId/availability')
  @Roles('hotelModerator')
  @ApiOperation({
    summary: 'Add a non-overlapping bookable date range; "to" is exclusive (HTL-04)',
  })
  addAvailability(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() dto: RoomDateRangeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.addAvailability(user, id, roomId, dto);
  }

  @Patch(':roomId/availability')
  @Roles('hotelModerator')
  @ApiOperation({
    summary:
      'updateRange / removeRange (HTL-05) or block / unblock dates (HTL-06)',
  })
  updateAvailability(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomAvailabilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.rooms.updateAvailability(user, id, roomId, dto);
  }
}
