import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UploadsModule } from '../common/uploads/uploads.module';
import { HotelInventoryService } from './hotel-inventory.service';
import { HotelSearchService } from './hotel-search.service';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Room, RoomSchema } from './schemas/room.schema';

/**
 * Owner: Member 4 (Hotels). HotelBooking comes from the global
 * BookingsModule (Member 5).
 *
 * Exported for other members:
 *  - HotelInventoryService: assertRoomsBookable() / findOccupying() for
 *    hotel holds (HTL-16, HTL-18, Member 5)
 *  - HotelSearchService: search() for itineraries (ITN-25, Member 6)
 *  - computeHotelRefund() in hotel-policy.util.ts for HTL-21 (Member 5)
 *  - MongooseModule: Hotel, Room and Review models (admin, moderation)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    UploadsModule,
  ],
  controllers: [HotelsController, RoomsController, ReviewsController],
  providers: [
    HotelsService,
    HotelSearchService,
    HotelInventoryService,
    RoomsService,
    ReviewsService,
  ],
  exports: [MongooseModule, HotelInventoryService, HotelSearchService],
})
export class HotelsModule {}
