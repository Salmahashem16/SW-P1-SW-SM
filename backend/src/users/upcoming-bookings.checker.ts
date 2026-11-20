/**
 * ACC-12: a user cannot deactivate their account while they have upcoming
 * Confirmed flight bookings or hotel reservations.
 *
 * The bookings member owns that data, so UsersService only depends on this
 * small interface. To plug it in, the bookings member adds a global module:
 *
 *   @Global()
 *   @Module({
 *     providers: [
 *       { provide: UPCOMING_BOOKINGS_CHECKER, useClass: BookingsUpcomingChecker },
 *     ],
 *     exports: [UPCOMING_BOOKINGS_CHECKER],
 *   })
 *   export class BookingsCheckerModule {}
 *
 * and imports it in AppModule. Until then, the check is skipped with a warning.
 */
export const UPCOMING_BOOKINGS_CHECKER = 'UPCOMING_BOOKINGS_CHECKER';

export interface UpcomingBookingsChecker {
  /** True if the user has any Confirmed flight booking or hotel reservation in the future. */
  hasUpcomingConfirmedBookings(userId: string): Promise<boolean>;
}
