import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ItinerariesService } from './itineraries.service';

@ApiTags('Public Itineraries')
@Controller('itineraries/public')
export class PublicItinerariesController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  @Get('search')
  search(@Query('q') q?: string, @Query('country') country?: string,
    @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.itinerariesService.searchPublic({ q, country, page, limit });
  }
  @Get(':id')
  get(@Param('id') id: string) {
    return this.itinerariesService.findPublic(id);
  }
}
