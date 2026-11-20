import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { HotelBookingsService } from './hotel-bookings.service';

const EVERY_MINUTE = 60 * 1000;

/**
 * GEN-11: once a minute, expired holds become Expired (HTL-18) and finished
 * stays become Completed so they can be reviewed (HTL-23). Reads never wait
 * for this job: holds past holdExpiresAt already stop occupying rooms.
 */
@Injectable()
export class HotelBookingStatusJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(HotelBookingStatusJob.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly bookings: HotelBookingsService) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => void this.run(), EVERY_MINUTE);
    this.timer.unref();
    void this.run();
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(now: Date = new Date()) {
    try {
      const expired = await this.bookings.expireHolds(now);
      const completed = await this.bookings.completeStays(now);
      if (expired || completed) {
        this.logger.log(`Hotel bookings: ${expired} hold(s) expired, ${completed} stay(s) completed`);
      }
    } catch (error) {
      this.logger.error(`Hotel booking status job failed: ${String(error)}`);
    }
  }
}
