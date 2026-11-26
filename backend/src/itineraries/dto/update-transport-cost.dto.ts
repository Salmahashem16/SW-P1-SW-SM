import { PartialType } from '@nestjs/swagger';
import { CreateTransportCostDto } from './create-transport-cost.dto';
export class UpdateTransportCostDto extends PartialType(CreateTransportCostDto) {}
