import { qualifies } from './hotel-search.service';

const rooms = (...occ: number[]) => occ.map((maxOccupancy) => ({ maxOccupancy }));

describe('hotel search qualification (HTL-11)', () => {
  it('needs at least the requested number of free rooms', () => {
    expect(qualifies(rooms(4), 2, 2)).toBe(false);
    expect(qualifies(rooms(1, 1), 2, 2)).toBe(true);
  });

  it('uses the largest rooms to cover the guests', () => {
    expect(qualifies(rooms(1, 2, 4), 2, 6)).toBe(true);
    expect(qualifies(rooms(1, 2, 3), 2, 6)).toBe(false);
  });
});
