
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Airline, AirlineSchema } from './schemas/airline.schema';
import { Airport, AirportSchema } from './schemas/airport.schema';
import { Flight, FlightSchema } from './schemas/flight.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Airline.name, schema: AirlineSchema },
      { name: Airport.name, schema: AirportSchema },
      { name: Flight.name, schema: FlightSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class FlightsModule {}
