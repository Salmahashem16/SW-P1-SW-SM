import { Module } from '@nestjs/common';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { FlightsModule } from '../flights/flights.module';
import { HotelsModule } from '../hotels/hotels.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProvidersAdminController } from './providers-admin.controller';
import { ProvidersAdminService } from './providers-admin.service';

@Module({
  imports: [UsersModule, AuditLogsModule, HotelsModule, FlightsModule],
  controllers: [AdminController, ProvidersAdminController],
  providers: [AdminService, ProvidersAdminService],
})
export class AdminModule {}
