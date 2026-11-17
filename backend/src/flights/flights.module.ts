import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Airline, AirlineSchema } from './schemas/airline.schema';

/**
 * Owner: Member 3 (Flights). Add your Flight/Airport schemas, controllers
 * and services here. MongooseModule is exported so other modules (admin,
 * bookings) can inject the Airline model.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Airline.name, schema: AirlineSchema }]),
  ],
  exports: [MongooseModule],
})
export class FlightsModule {}
