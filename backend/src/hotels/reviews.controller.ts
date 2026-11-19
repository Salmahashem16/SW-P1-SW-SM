import {
  Body,
  Controller,
  Delete,
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
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

/** HTL-23. Listing is GET /api/hotels/:id/reviews (HTL-24). */
@ApiTags('Hotel Reviews')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('registeredUser')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('hotel-bookings/:id/review')
  @ApiOperation({
    summary: 'Rate (1-5) and review a Completed reservation, once (HTL-23)',
  })
  create(
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.create(user, bookingId, dto);
  }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Edit your review (HTL-23)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.update(user, id, dto);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete your review (HTL-23)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.reviews.remove(user, id);
  }
}
