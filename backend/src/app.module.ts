import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { setServers } from 'node:dns';

import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { HotelBookingsModule } from './bookings/hotel-bookings/hotel-bookings.module';
import { DomainEventsModule } from './common/events/domain-events';
import { FlightsModule } from './flights/flights.module';
import { HotelsModule } from './hotels/hotels.module';
import { ModerationModule } from './moderation/moderation.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {        // ← here
        const uri = config.get<string>('MONGODB_URI');

        if (!uri) {
          throw new Error('MONGODB_URI is missing from the root .env file');
        }

        // Use public DNS if the local resolver can't do SRV lookups.
        const dnsServers = config.get<string>('DNS_SERVERS');
        if (dnsServers) {
          setServers(dnsServers.split(',').map((s) => s.trim()));
        }

        return { uri };
      },
    }),
    DomainEventsModule,
    UsersModule,
    AuthModule,
    FlightsModule,
    HotelsModule,
    BookingsModule,
    HotelBookingsModule,
    AuditLogsModule,
    AdminModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}