import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/pagination-query.dto';
import {
  imagesApiBody,
  imageUploadOptions,
  MAX_IMAGES_PER_ITEM,
} from '../common/uploads/image-upload';
import type { UploadedImage } from '../common/uploads/image-upload';
import {
  AvailabilityCalendarQueryDto,
  ListReservationsQueryDto,
  OptionalStayQueryDto,
  SearchHotelsDto,
  StayQueryDto,
} from './dto/hotel-query.dto';
import { CreateHotelDto, UpdateHotelDto, UpdateHotelPoliciesDto } from './dto/hotel.dto';
import { HotelSearchService } from './hotel-search.service';
import { HotelsService } from './hotels.service';
import { ReviewsService } from './reviews.service';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly search: HotelSearchService,
    private readonly reviews: ReviewsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a hotel profile (HTL-01, admin)' })
  create(@Body() dto: CreateHotelDto) {
    return this.hotels.create(dto);
  }

  // Declared before :id so "search" is not read as an id.
  @Get('search')
  @ApiOperation({
    summary: 'Search hotels by city/country, dates, guests and rooms (HTL-11, HTL-12)',
  })
  searchHotels(@Query() dto: SearchHotelsDto) {
    return this.search.search(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Hotel details; pass checkIn/checkOut to include free rooms (HTL-02)',
  })
  getDetails(@Param('id') id: string, @Query() query: OptionalStayQueryDto) {
    return this.hotels.getDetails(id, query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator', 'admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: "Edit the hotel's profile (HTL-01)" })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHotelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.update(user, id, dto);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator', 'admin')
  @ApiCookieAuth('access_token')
  @ApiConsumes('multipart/form-data')
  @ApiBody(imagesApiBody('photos'))
  @UseInterceptors(FilesInterceptor('photos', MAX_IMAGES_PER_ITEM, imageUploadOptions))
  @ApiOperation({ summary: 'Upload hotel photos: JPG/PNG, 5 MB each, max 5 (HTL-01, GEN-08)' })
  addPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: UploadedImage[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.addPhotos(user, id, files);
  }

  @Delete(':id/photos/:photoId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator', 'admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Remove a hotel photo (HTL-01, GEN-08)' })
  removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.removePhoto(user, id, photoId);
  }

  @Put(':id/policies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Set check-in/check-out times and cancellation tiers (HTL-09, HTL-10)',
  })
  setPolicies(
    @Param('id') id: string,
    @Body() dto: UpdateHotelPoliciesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.setPolicies(user, id, dto);
  }

  @Get(':id/rooms/available')
  @ApiOperation({
    summary: 'Rooms free for the dates, with total stay price (HTL-15)',
  })
  availableRooms(@Param('id') id: string, @Query() query: StayQueryDto) {
    return this.search.availableRooms(id, query.checkIn, query.checkOut);
  }

  @Get(':id/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator', 'admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: "Each room's status per night: Available, Booked or Blocked (HTL-08)",
  })
  availability(
    @Param('id') id: string,
    @Query() query: AvailabilityCalendarQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.availabilityCalendar(user, id, query);
  }

  @Get(':id/reservations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hotelModerator', 'admin')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: "Reservations for the moderator's hotel (HTL-22)" })
  reservations(
    @Param('id') id: string,
    @Query() query: ListReservationsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hotels.listReservations(user, id, query);
  }

  @Get(':id/reviews')
  @ApiOperation({
    summary: 'Average rating, count and reviews, newest first (HTL-24)',
  })
  listReviews(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.reviews.listForHotel(id, query);
  }
}
