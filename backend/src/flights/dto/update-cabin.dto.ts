
import { PartialType, PickType } from '@nestjs/swagger';

import { CreateCabinDto } from './create-cabin.dto';

export class UpdateCabinDto extends PartialType(
  PickType(CreateCabinDto, [
    'capacity',
    'price',
    'freeBaggageCount',
    'maxBagWeightKg',
  ] as const),
) {}
