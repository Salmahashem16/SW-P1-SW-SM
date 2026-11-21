import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ItinerariesController } from './itineraries.controller';
import { PublicItinerariesController } from './public-itineraries.controller';
import { ActivityImagesController } from './activity-images.controller';
import { ItinerarySearchController } from './itinerary-search.controller';
import { ActivitiesController } from './activities.controller';
import { BudgetsController } from './budgets.controller';
import { TransportCostsController } from './transport-costs.controller';
import { ItinerariesService } from './itineraries.service';
import { FxRatesService } from './fx-rates.service';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }])],
  controllers: [PublicItinerariesController, ItinerariesController, ActivityImagesController, ItinerarySearchController, ActivitiesController, BudgetsController, TransportCostsController],
  providers: [ItinerariesService, FxRatesService],
})
export class ItinerariesModule {}
