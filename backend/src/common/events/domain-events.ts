import { Global, Injectable, Logger, Module } from '@nestjs/common';

import type { ProviderType, UserRole } from '../../users/schemas/user.schema';

/**
 * Events other modules can react to without importing each other.
 * Used for GEN-01 in-app notifications: the module that does something
 * emits, and the notifications module listens.
 *
 * Add new events here as you need them.
 */
export interface DomainEventMap {
  /** ACC-15 / ACC-16 */
  'account.suspended': { userId: string; role: UserRole; reason: string | null };
  'account.reactivated': { userId: string; role: UserRole };
  /** ACC-15: moderatorIds are the accounts linked to this provider. */
  'provider.deactivated': {
    providerType: ProviderType;
    providerId: string;
    providerName: string;
    moderatorIds: string[];
    reason: string | null;
  };
  'provider.reactivated': {
    providerType: ProviderType;
    providerId: string;
    providerName: string;
    moderatorIds: string[];
  };
  /** HTL-17: reservation paid and Confirmed (notify the guest). */
  'hotelBooking.confirmed': {
    bookingId: string;
    userId: string;
    hotelId: string;
    hotelName: string;
    bookingReference: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    currency: string;
  };
  /** HTL-21: reservation cancelled; PAY-03 refunds refundAmount if > 0. */
  'hotelBooking.cancelled': {
    bookingId: string;
    userId: string;
    hotelId: string;
    hotelName: string;
    bookingReference: string | null;
    paymentId: string | null;
    refundAmount: number;
    currency: string;
  };
}

export type DomainEventName = keyof DomainEventMap;
type Handler<K extends DomainEventName> = (
  payload: DomainEventMap[K],
) => void | Promise<void>;

/**
 * Listening (e.g. in NotificationsService):
 *
 *   constructor(events: DomainEvents) {
 *     events.on('account.suspended', (e) => this.create(e.userId, ...));
 *   }
 *
 * A failing listener is logged and never fails the action that emitted.
 */
@Injectable()
export class DomainEvents {
  private readonly logger = new Logger(DomainEvents.name);
  private readonly handlers = new Map<DomainEventName, Handler<never>[]>();

  on<K extends DomainEventName>(name: K, handler: Handler<K>): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(name, list);
  }

  async emit<K extends DomainEventName>(
    name: K,
    payload: DomainEventMap[K],
  ): Promise<void> {
    const list = (this.handlers.get(name) ?? []) as Handler<K>[];

    const results = await Promise.allSettled(
      list.map(async (handler) => handler(payload)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `Listener for "${name}" failed: ${String(result.reason)}`,
        );
      }
    }
  }
}

/** Global, so any module can inject DomainEvents without importing this. */
@Global()
@Module({
  providers: [DomainEvents],
  exports: [DomainEvents],
})
export class DomainEventsModule {}
