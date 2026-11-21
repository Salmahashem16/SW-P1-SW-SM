import { BadGatewayException, Injectable } from '@nestjs/common';

type RatesResponse = {
  success?: boolean;
  base?: string;
  date?: string;
  timestamp?: number;
  rates?: Record<string, number>;
};

@Injectable()
export class FxRatesService {
  private cache?: { data: RatesResponse; expiresAt: number };

  async getRates(): Promise<RatesResponse> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.data;

    const apiKey = process.env.FXRATESAPI_KEY?.trim();

    const url = new URL('https://api.fxratesapi.com/latest');
    if (apiKey) url.searchParams.set('api_key', apiKey);

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new BadGatewayException('Unable to reach FXRatesAPI');
    }
    if (!response.ok) {
      throw new BadGatewayException(`FXRatesAPI returned HTTP ${response.status}`);
    }

    let data: RatesResponse;
    try {
      data = (await response.json()) as RatesResponse;
    } catch {
      throw new BadGatewayException('FXRatesAPI returned invalid JSON');
    }
    if (data.success !== true || !data.base || !data.rates ||
        typeof data.rates !== 'object') {
      throw new BadGatewayException('FXRatesAPI did not return valid base exchange rates');
    }
    this.cache = { data, expiresAt: Date.now() + 10 * 60 * 1000 };
    return data;
  }
}
