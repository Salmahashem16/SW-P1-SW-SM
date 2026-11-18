
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { CreateFlightDto } from './dto/create-flight.dto';
import { Airline } from './schemas/airline.schema';
import { Airport } from './schemas/airport.schema';
import { Flight } from './schemas/flight.schema';
import { localTimeToUtc } from './flight-time.util';

import { CreateCabinDto } from './dto/create-cabin.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { UpdateBaggagePolicyDto } from './dto/update-baggage-policy.dto';

@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Airline.name)
    private readonly airlineModel: Model<Airline>,

    @InjectModel(Airport.name)
    private readonly airportModel: Model<Airport>,

    @InjectModel(Flight.name)
    private readonly flightModel: Model<Flight>,
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
