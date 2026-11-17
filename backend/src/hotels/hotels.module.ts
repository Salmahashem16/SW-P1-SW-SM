import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Hotel, HotelSchema } from './schemas/hotel.schema';

/**
 * Owner: Member 4 (Hotels). Add your Room/availability schemas,
 * controllers and services here. MongooseModule is exported so other
 * modules (admin, bookings) can inject the Hotel model.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Hotel.name, schema: HotelSchema }]),
  ],
  exports: [MongooseModule],
})
export class HotelsModule {}
