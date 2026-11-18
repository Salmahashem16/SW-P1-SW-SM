
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateFlightDto } from './dto/update-flight.dto';
import type { AuthUser } from '../auth/auth.types';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { Airline } from './schemas/airline.schema';
import { Airport } from './schemas/airport.schema';
import { Flight } from './schemas/flight.schema';
import { localTimeToUtc } from './flight-time.util';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';
import { CreateCabinDto } from './dto/create-cabin.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateBaggagePolicyDto } from './dto/update-baggage-policy.dto';
import { FlightBooking } from '../bookings/schemas/flight-booking.schema';
import { SearchFlightsDto } from './dto/search-flights.dto';

@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<Airline>,

    @InjectModel(Airport.name)
    private readonly airportModel: Model<Airport>,

    @InjectModel(Flight.name)
    private readonly flightModel: Model<Flight>,
    @InjectModel(FlightBooking.name)
    private readonly flightBookingModel: Model<FlightBooking>,
  ) {}

  async getAirports() {
    return this.airportModel
      .find()
      .select('code name city country timeZone')
      .sort({ country: 1, city: 1, code: 1 })
      .lean()
      .exec();
  }

  async createAirline(dto: CreateAirlineDto) {
    const code = dto.code.trim().toUpperCase();

    const existingAirline = await this.airlineModel
      .findOne({ code })
      .exec();

    if (existingAirline) {
      throw new ConflictException(
        'Airline code already exists',
      );
    }

    try {
      return await this.airlineModel.create({
        name: dto.name.trim(),
        code,
        logo: dto.logo ?? null,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException(
          'Airline code already exists',
        );
      }

      throw error;
    }
  }

  async getAirline(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Airline not found');
    }

    const airline = await this.airlineModel
      .findById(id)
      .lean()
      .exec();

    if (!airline) {
      throw new NotFoundException('Airline not found');
    }

    return airline;
  }

  async updateAirline(
    id: string,
    dto: UpdateAirlineDto,
    user: AuthUser,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Airline not found');
    }

    if (
      user.role !== 'airlineModerator' ||
      user.providerType !== 'airline' ||
      user.providerId !== id
    ) {
      throw new ForbiddenException(
        'You can only update your assigned airline',
      );
    }

    const update: Record<string, string> = {};

    if (dto.name !== undefined) {
      update.name = dto.name.trim();
    }

    if (dto.code !== undefined) {
      update.code = dto.code.trim().toUpperCase();
    }

    if (dto.logo !== undefined) {
      update.logo = dto.logo;
    }

    try {
      const airline = await this.airlineModel
        .findByIdAndUpdate(
          id,
          { $set: update },
          {
            new: true,
            runValidators: true,
          },
        )
        .exec();

      if (!airline) {
        throw new NotFoundException(
          'Airline not found',
        );
      }

      return airline;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException(
          'Airline code already exists',
        );
      }

      throw error;
    }
  }

async getFlightDetails(flightId: string) {
  if (!Types.ObjectId.isValid(flightId)) {
    throw new NotFoundException('Flight not found');
  }

  const flight = await this.flightModel
    .findById(flightId)
    .populate('airlineId', 'name code logo isActive')
    .populate(
      'departureAirportId',
      'code name city country timeZone',
    )
    .populate(
      'arrivalAirportId',
      'code name city country timeZone',
    )
    .lean()
    .exec();

  if (!flight) {
    throw new NotFoundException('Flight not found');
  }

  // Prevent inactive airline flights from appearing publicly.
  const airline = flight.airlineId as unknown as {
    isActive: boolean;
  };

  if (!airline || !airline.isActive) {
    throw new NotFoundException('Flight not found');
  }

  if (flight.status !== 'Scheduled') {
    throw new NotFoundException(
      'Flight is not available for booking',
    );
  }

  return flight;
}

async searchFlights(dto: SearchFlightsDto) {
  const {
    departureAirportId,
    arrivalAirportId,
    departureDate,
    returnDate,
    cabinClass,
    minPrice,
    maxPrice,
    sortBy = 'departure',
    sortOrder = 'asc',
    page = 1,
    limit = 10,
    tripType = 'one-way',
  } = dto;

  const adults = dto.adults ?? 1;
  const children = dto.children ?? 0;
  const infants = dto.infants ?? 0;

  const passengerCount = adults + children;

  // Validate route.
  if (departureAirportId === arrivalAirportId) {
    throw new BadRequestException(
      'Departure and arrival airports must be different',
    );
  }

  // Validate passenger counts.
  if (infants > adults) {
    throw new BadRequestException(
      'Infants cannot exceed the number of adults',
    );
  }

  // Validate calendar dates, not just their format.
  const isValidDate = (value: string): boolean => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };

  if (!isValidDate(departureDate)) {
    throw new BadRequestException(
      'Invalid departure date',
    );
  }

  if (tripType === 'round-trip') {
    if (!returnDate || !isValidDate(returnDate)) {
      throw new BadRequestException(
        'A valid return date is required for round-trip searches',
      );
    }

    if (returnDate < departureDate) {
      throw new BadRequestException(
        'Return date cannot be before departure date',
      );
    }
  } else if (returnDate !== undefined) {
    throw new BadRequestException(
      'Return date is only allowed for round-trip searches',
    );
  }

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    throw new BadRequestException(
      'Minimum price cannot exceed maximum price',
    );
  }

  // Check that both airports exist.
  const airports = await Promise.all([
    this.airportModel.exists({
      _id: departureAirportId,
    }),
    this.airportModel.exists({
      _id: arrivalAirportId,
    }),
  ]);

  if (!airports[0] || !airports[1]) {
    throw new BadRequestException(
      'Departure or arrival airport does not exist',
    );
  }

  // Only flights belonging to active airlines are searchable.
  const activeAirlines = await this.airlineModel
    .find({ isActive: true })
    .select('_id')
    .lean()
    .exec();

  const activeAirlineIds = activeAirlines.map(
    (airline) => airline._id,
  );

  const searchLeg = async (
    fromAirportId: string,
    toAirportId: string,
    travelDate: string,
  ) => {
    const flights = await this.flightModel
      .find({
        departureAirportId: fromAirportId,
        arrivalAirportId: toAirportId,
        departureLocalDate: travelDate,
        departureAt: { $gt: new Date() },
        status: 'Scheduled',
        airlineId: { $in: activeAirlineIds },
      })
      .lean()
      .exec();

    const results = flights.flatMap((flight) => {
      // Cabins must have sufficient configured capacity.
      // Actual seat availability will require booking/hold integration.
      const eligibleCabins = flight.cabins.filter(
        (cabin) =>
          (!cabinClass ||
            cabin.cabinClass === cabinClass) &&
          cabin.capacity >= passengerCount &&
          (minPrice === undefined ||
            cabin.price >= minPrice) &&
          (maxPrice === undefined ||
            cabin.price <= maxPrice),
      );

      if (eligibleCabins.length === 0) {
        return [];
      }

      // Choose the cheapest eligible cabin for each flight.
      const selectedCabin = eligibleCabins.reduce(
        (cheapest, current) =>
          current.price < cheapest.price
            ? current
            : cheapest,
      );

      return [
        {
          ...flight,
          selectedCabin,
          displayedPrice: selectedCabin.price,
          currency: selectedCabin.currency,
        },
      ];
    });

    const direction = sortOrder === 'desc' ? -1 : 1;

    results.sort((a, b) => {
      if (sortBy === 'price') {
        return (
          (a.displayedPrice - b.displayedPrice) *
          direction
        );
      }

      if (sortBy === 'arrival') {
        return (
          (new Date(a.arrivalAt).getTime() -
            new Date(b.arrivalAt).getTime()) *
          direction
        );
      }

      return (
        (new Date(a.departureAt).getTime() -
          new Date(b.departureAt).getTime()) *
        direction
      );
    });

    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    return {
      data: results.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  };

  const outbound = await searchLeg(
    departureAirportId,
    arrivalAirportId,
    departureDate,
  );

  if (tripType === 'one-way') {
    return {
      tripType,
      outbound,
    };
  }

  const inbound = await searchLeg(
    arrivalAirportId,
    departureAirportId,
    returnDate!,
  );

  return {
    tripType,
    outbound,
    inbound,
  };
}

  async createFlight(
    dto: CreateFlightDto,
    user: AuthUser,
  ) {
    if (
      user.role !== 'airlineModerator' ||
      user.providerType !== 'airline' ||
      !user.providerId ||
      !Types.ObjectId.isValid(user.providerId)
    ) {
      throw new ForbiddenException(
        'Only assigned airline moderators can create flights',
      );
    }

    if (
      dto.departureAirportId ===
      dto.arrivalAirportId
    ) {
      throw new BadRequestException(
        'Departure and arrival airports must be different',
      );
    }

    const airline = await this.airlineModel
      .findById(user.providerId)
      .exec();

    if (!airline || !airline.isActive) {
      throw new ForbiddenException(
        'Assigned airline is not active',
      );
    }

    const [departureAirport, arrivalAirport] =
      await Promise.all([
        this.airportModel
          .findById(dto.departureAirportId)
          .exec(),
        this.airportModel
          .findById(dto.arrivalAirportId)
          .exec(),
      ]);

    if (
      !departureAirport ||
      !arrivalAirport
    ) {
      throw new BadRequestException(
        'Both airports must exist in the reference dataset',
      );
    }

    const departureAt = localTimeToUtc(
      dto.departureLocalTime,
      departureAirport.timeZone,
    );

    const arrivalAt = localTimeToUtc(
      dto.arrivalLocalTime,
      arrivalAirport.timeZone,
    );

    if (
      departureAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Departure time must be in the future',
      );
    }

    if (
      arrivalAt.getTime() <=
      departureAt.getTime()
    ) {
      throw new BadRequestException(
        'Arrival must be after departure',
      );
    }

    const flightNumber = dto.flightNumber
      .trim()
      .toUpperCase();

    const departureLocalDate =
      dto.departureLocalTime.slice(0, 10);

    const duplicate = await this.flightModel
      .exists({
        airlineId: airline._id,
        flightNumber,
        departureLocalDate,
      })
      .exec();

    if (duplicate) {
      throw new ConflictException(
        'Flight number already exists for this airline on this date',
      );
    }

    try {
      return await this.flightModel.create({
        airlineId: airline._id,
        flightNumber,
        departureAirportId:
          departureAirport._id,
        arrivalAirportId:
          arrivalAirport._id,
        departureAt,
        arrivalAt,
        departureLocalDate,
        status: 'Scheduled',
        cabins: [],
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new ConflictException(
          'Flight number already exists for this airline on this date',
        );
      }

      throw error;
    }
  }

async updateFlight(
  flightId: string,
  dto: UpdateFlightDto,
  user: AuthUser,
) {
  if (!Types.ObjectId.isValid(flightId)) {
    throw new NotFoundException('Flight not found');
  }

  const flight = await this.flightModel
    .findById(flightId)
    .exec();

  if (!flight) {
    throw new NotFoundException('Flight not found');
  }

  this.assertAirlineOwnership(
    user,
    flight.airlineId.toString(),
  );

  if (flight.status !== 'Scheduled') {
    throw new BadRequestException(
      'Only Scheduled flights can be updated',
    );
  }

  if (Object.keys(dto).length === 0) {
    throw new BadRequestException(
      'At least one field must be provided',
    );
  }

  const departureAirportId =
    dto.departureAirportId ??
    flight.departureAirportId.toString();

  const arrivalAirportId =
    dto.arrivalAirportId ??
    flight.arrivalAirportId.toString();

  if (departureAirportId === arrivalAirportId) {
    throw new BadRequestException(
      'Departure and arrival airports must be different',
    );
  }

  const [departureAirport, arrivalAirport] =
    await Promise.all([
      this.airportModel.findById(departureAirportId).exec(),
      this.airportModel.findById(arrivalAirportId).exec(),
    ]);

  if (!departureAirport || !arrivalAirport) {
    throw new BadRequestException(
      'Both airports must exist in the reference dataset',
    );
  }

  // Preserve existing UTC times unless new local times are supplied.
  // If an airport changes, a new local time is required for that airport.
  if (
    dto.departureAirportId !== undefined &&
    dto.departureLocalTime === undefined
  ) {
    throw new BadRequestException(
      'Departure local time is required when changing departure airport',
    );
  }

  if (
    dto.arrivalAirportId !== undefined &&
    dto.arrivalLocalTime === undefined
  ) {
    throw new BadRequestException(
      'Arrival local time is required when changing arrival airport',
    );
  }

  const departureAt = dto.departureLocalTime
    ? localTimeToUtc(
        dto.departureLocalTime,
        departureAirport.timeZone,
      )
    : flight.departureAt;

  const arrivalAt = dto.arrivalLocalTime
    ? localTimeToUtc(
        dto.arrivalLocalTime,
        arrivalAirport.timeZone,
      )
    : flight.arrivalAt;

  if (departureAt.getTime() <= Date.now()) {
    throw new BadRequestException(
      'Departure time must be in the future',
    );
  }

  if (arrivalAt.getTime() <= departureAt.getTime()) {
    throw new BadRequestException(
      'Arrival must be after departure',
    );
  }

  const flightNumber = dto.flightNumber
    ? dto.flightNumber.trim().toUpperCase()
    : flight.flightNumber;

  const departureLocalDate = dto.departureLocalTime
    ? dto.departureLocalTime.slice(0, 10)
    : flight.departureLocalDate;

  try {
    const updated = await this.flightModel
      .findOneAndUpdate(
        {
          _id: flightId,
          status: 'Scheduled',
        },
        {
          $set: {
            flightNumber,
            departureAirportId:
              new Types.ObjectId(departureAirportId),
            arrivalAirportId:
              new Types.ObjectId(arrivalAirportId),
            departureAt,
            arrivalAt,
            departureLocalDate,
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Flight is no longer available for updating',
      );
    }

    return updated;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new ConflictException(
        'Flight number already exists for this airline on this date',
      );
    }

    throw error;
  }
}

  async addCabin(
    flightId: string,
    dto: CreateCabinDto,
    user: AuthUser,
  ) {
    if (!Types.ObjectId.isValid(flightId)) {
      throw new NotFoundException('Flight not found');
    }

    const flight = await this.flightModel
      .findById(flightId)
      .exec();

    if (!flight) {
      throw new NotFoundException('Flight not found');
    }

    this.assertAirlineOwnership(user, flight.airlineId.toString());

    if (flight.status !== 'Scheduled') {
      throw new BadRequestException(
        'Cabins can only be added to Scheduled flights',
      );
    }

    const updated = await this.flightModel
      .findOneAndUpdate(
        {
          _id: flight._id,
          status: 'Scheduled',
          cabins: {
            $not: {
              $elemMatch: {
                cabinClass: dto.cabinClass,
              },
            },
          },
        },
        {
          $push: {
            cabins: {
              cabinClass: dto.cabinClass,
              capacity: dto.capacity,
              price: dto.price,
              currency: dto.currency,
              freeBaggageCount: dto.freeBaggageCount,
              maxBagWeightKg: dto.maxBagWeightKg,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Cabin already exists or flight is no longer Scheduled',
      );
    }

    return updated;
  }

  async updateCabin(
    flightId: string,
    cabinId: string,
    dto: UpdateCabinDto,
    user: AuthUser,
  ) {
    if (
      !Types.ObjectId.isValid(flightId) ||
      !Types.ObjectId.isValid(cabinId)
    ) {
      throw new NotFoundException('Flight or cabin not found');
    }

    const flight = await this.flightModel
      .findById(flightId)
      .exec();

    if (!flight) {
      throw new NotFoundException('Flight not found');
    }

    this.assertAirlineOwnership(user, flight.airlineId.toString());

    if (flight.status !== 'Scheduled') {
      throw new BadRequestException(
        'Only Scheduled flights can be updated',
      );
    }

    const cabin = flight.cabins.find(
      (item) =>
        String(
          (item as typeof item & { _id: Types.ObjectId })._id,
        ) === cabinId,
    );

    if (!cabin) {
      throw new NotFoundException('Cabin not found');
    }

    if (
      dto.capacity !== undefined &&
      dto.capacity < cabin.capacity
    ) {
      throw new ConflictException(
        'Capacity reductions require booked and held seat checks',
      );
    }

    const update: Record<string, number> = {};

    if (dto.capacity !== undefined) {
      update['cabins.$.capacity'] = dto.capacity;
    }

    if (dto.price !== undefined) {
      update['cabins.$.price'] = dto.price;
    }

    if (dto.freeBaggageCount !== undefined) {
      update['cabins.$.freeBaggageCount'] =
        dto.freeBaggageCount;
    }

    if (dto.maxBagWeightKg !== undefined) {
      update['cabins.$.maxBagWeightKg'] =
        dto.maxBagWeightKg;
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException(
        'At least one field must be provided',
      );
    }

    const updated = await this.flightModel
      .findOneAndUpdate(
        {
          _id: flightId,
          status: 'Scheduled',
          cabins: {
            $elemMatch: {
              _id: new Types.ObjectId(cabinId),
              ...(dto.capacity !== undefined
                ? { capacity: { $lte: dto.capacity } }
                : {}),
            },
          },
        },
        { $set: update },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updated) {
      throw new ConflictException(
        'Cabin update could not be completed',
      );
    }

    return updated;
  }

  async updateBaggagePolicy(
    airlineId: string,
    dto: UpdateBaggagePolicyDto,
    user: AuthUser,
  ) {
    if (!Types.ObjectId.isValid(airlineId)) {
      throw new NotFoundException('Airline not found');
    }

    this.assertAirlineOwnership(user, airlineId);

    const airline = await this.airlineModel
      .findByIdAndUpdate(
        airlineId,
        {
          $set: {
            baggagePolicy: {
              extraBagPrice: dto.extraBagPrice,
              maxExtraBags: dto.maxExtraBags,
            },
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!airline) {
      throw new NotFoundException('Airline not found');
    }

    return airline;
  }

async updateCancellationPolicy(
  airlineId: string,
  dto: UpdateCancellationPolicyDto,
  user: AuthUser,
) {
  if (!Types.ObjectId.isValid(airlineId)) {
    throw new NotFoundException('Airline not found');
  }

  // Only the moderator assigned to this airline can update its policy.
  this.assertAirlineOwnership(user, airlineId);

  const airline = await this.airlineModel
    .findOneAndUpdate(
      {
        _id: airlineId,
        isActive: true,
      },
      {
        $set: {
          cancellationPolicy: {
            cancellationDeadlineHours:
              dto.cancellationDeadlineHours,
            refundPercentage: dto.refundPercentage,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
    .exec();

  if (!airline) {
    throw new NotFoundException(
      'Active airline not found',
    );
  }

  return airline;
}

async cancelFlight(
  flightId: string,
  user: AuthUser,
) {
  if (!Types.ObjectId.isValid(flightId)) {
    throw new NotFoundException('Flight not found');
  }

  const flight = await this.flightModel
    .findById(flightId)
    .exec();

  if (!flight) {
    throw new NotFoundException('Flight not found');
  }

  this.assertAirlineOwnership(
    user,
    flight.airlineId.toString(),
  );

  if (flight.status === 'Cancelled') {
    throw new ConflictException(
      'Flight has already been cancelled',
    );
  }

  if (flight.status !== 'Scheduled') {
    throw new BadRequestException(
      'Only Scheduled flights can be cancelled',
    );
  }

  // Temporary safety check until bookings include flight references.
  // This checks the entire airline, not the specific flight.
  const activeBookings = await this.flightBookingModel.exists({
    airlineId: flight.airlineId,
    status: { $in: ['pendingPayment', 'confirmed'] },
  });

  if (activeBookings) {
    throw new ConflictException(
      'Cancellation is temporarily blocked because this airline has active bookings',
    );
  }

  const cancelled = await this.flightModel
    .findOneAndUpdate(
      {
        _id: flightId,
        status: 'Scheduled',
      },
      {
        $set: {
          status: 'Cancelled',
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
    .exec();

  if (!cancelled) {
    throw new ConflictException(
      'Flight status changed during cancellation',
    );
  }

  return cancelled;
}

  private assertAirlineOwnership(
    user: AuthUser,
    airlineId: string,
  ): void {
    if (
      user.role !== 'airlineModerator' ||
      user.providerType !== 'airline' ||
      user.providerId !== airlineId
    ) {
      throw new ForbiddenException(
        'You can only manage your assigned airline',
      );
    }
  }

}
