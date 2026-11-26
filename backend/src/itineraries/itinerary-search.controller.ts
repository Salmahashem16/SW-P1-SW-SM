import { BadGatewayException, Controller, Get, HttpException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { ItinerariesService } from './itineraries.service';

@ApiTags('Itinerary Search Integration')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('itineraries')
export class ItinerarySearchController {
  constructor(private readonly itinerariesService: ItinerariesService) {}

  private async callExistingSearch(path: string, query: Record<string, string>, req: Request) {
    // Delegate to the team's existing search implementation, rather than duplicating pricing/availability logic.
    const port = Number(process.env.PORT || 4000);
    const url = new URL(`http://127.0.0.1:${port}${path}`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') url.searchParams.set(key, value);
    });
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}) },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new BadGatewayException('Search service unavailable');
    }
    const contentType = response.headers.get('content-type') ?? '';
    const data: unknown = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new HttpException(data ?? 'Search request failed', response.status);
    return data;
  }

  @Get(':id/hotels')
  async hotels(@Param('id') id: string, @Query() query: Record<string, string>,
    @Req() req: Request, @CurrentUser() user: AuthUser) {
    const itinerary = await this.itinerariesService.findOne(id, user.userId);
    const results = await this.callExistingSearch('/api/hotels/search', query, req);
    return { itineraryId: id, cityIds: itinerary.days.map(day => day.cityId), results };
  }

  @Get(':id/flights')
  async flights(@Param('id') id: string, @Query() query: Record<string, string>,
    @Req() req: Request, @CurrentUser() user: AuthUser) {
    const itinerary = await this.itinerariesService.findOne(id, user.userId);
    const results = await this.callExistingSearch('/api/flights/search', query, req);
    return { itineraryId: id, cityIds: itinerary.days.map(day => day.cityId), results };
  }
}
