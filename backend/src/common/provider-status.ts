import { Schema as MongooseSchema } from 'mongoose';
import type { Schema } from 'mongoose';

/**
 * ACC-15: an admin can deactivate a hotel or airline. A deactivated
 * provider is hidden from search and cannot be booked; its existing
 * Confirmed bookings stay valid.
 *
 * Applied to the Hotel and Airline schemas. Owners of search and booking:
 *
 *   // hotel / flight search
 *   hotelModel.find({ ...activeProviderFilter, city })
 *
 *   // before creating a hold or booking
 *   if (!isProviderActive(hotel)) throw new BadRequestException('This hotel is not accepting bookings');
 */
export function providerStatusPlugin(schema: Schema) {
  schema.add({
    isActive: { type: Boolean, default: true, index: true },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: {
      type: MongooseSchema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  });
}

/** Documents without the field count as active. */
export const activeProviderFilter = { isActive: { $ne: false } } as const;

export function isProviderActive(provider: { isActive?: boolean | null }) {
  return provider.isActive !== false;
}
