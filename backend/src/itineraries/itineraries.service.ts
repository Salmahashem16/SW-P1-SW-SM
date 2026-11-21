import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AddDayDto } from './dto/add-day.dto';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { ReorderDaysDto } from './dto/reorder-days.dto';
import { UpdateDayDto } from './dto/update-day.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { Itinerary } from './schemas/itinerary.schema';
import { FxRatesService } from './fx-rates.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateTransportCostDto } from './dto/create-transport-cost.dto';
import { UpdateTransportCostDto } from './dto/update-transport-cost.dto';

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name)
    private readonly itineraryModel: Model<Itinerary>,
    private readonly fxRatesService: FxRatesService,
  ) {}

  private toObjectId(id: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
    return new Types.ObjectId(id);
  }

  private recalculateDays(itinerary: Itinerary): void {
    const start = new Date(itinerary.startDate);
    itinerary.days.forEach((day, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      day.dayNumber = index + 1;
      day.date = date;
    });
  }

  async create(dto: CreateItineraryDto, userId: string) {
    const ownerId = this.toObjectId(userId, 'user ID');
    return this.itineraryModel.create({
      ...dto,
      ownerId,
    });
  }

  async findAll(userId: string) {
    const ownerId = this.toObjectId(userId, 'user ID');
    return this.itineraryModel.find({ ownerId }).exec();
  }

  async findOne(id: string, userId: string) {
    const itineraryId = this.toObjectId(id, 'itinerary ID');
    const ownerId = this.toObjectId(userId, 'user ID');
    const itinerary = await this.itineraryModel.findById(itineraryId).exec();

    if (!itinerary) {
      throw new NotFoundException('Itinerary not found');
    }
    if (!itinerary.ownerId.equals(ownerId)) {
      throw new ForbiddenException('You do not own this itinerary');
    }
    return itinerary;
  }

  async update(id: string, dto: UpdateItineraryDto, userId: string) {
    const itinerary = await this.findOne(id, userId);
    if (dto.title !== undefined) itinerary.title = dto.title;
    if (dto.countries !== undefined) itinerary.countries = dto.countries;
    if (dto.isPublic !== undefined) itinerary.isPublic = dto.isPublic;
    if (dto.startDate !== undefined) {
      itinerary.startDate = new Date(dto.startDate);
      this.recalculateDays(itinerary);
      itinerary.markModified('days');
    }
    return itinerary.save();
  }

  async remove(id: string, userId: string) {
    const itinerary = await this.findOne(id, userId);
    await itinerary.deleteOne();
    return { message: 'Itinerary deleted successfully' };
  }

  async addDay(id: string, dto: AddDayDto, userId: string) {
    const itinerary = await this.findOne(id, userId);
    const dayNumber = itinerary.days.length + 1;
    const date = new Date(itinerary.startDate);
    date.setUTCDate(date.getUTCDate() + dayNumber - 1);
    itinerary.days.push({
      _id: new Types.ObjectId(),
      dayNumber,
      cityId: dto.cityId,
      date,
      activities: [],
      budgets: [],
    });
    itinerary.markModified('days');
    return itinerary.save();
  }

  async updateDay(id: string, dayId: string, dto: UpdateDayDto, userId: string) {
    const itinerary = await this.findOne(id, userId);
    const requestedId = this.toObjectId(dayId, 'day ID');
    const day = itinerary.days.find((d) => d._id.equals(requestedId));
    if (!day) throw new NotFoundException('Day not found');
    day.cityId = dto.cityId;
    itinerary.markModified('days');
    return itinerary.save();
  }

  async removeDay(id: string, dayId: string, userId: string) {
    const itinerary = await this.findOne(id, userId);
    const requestedId = this.toObjectId(dayId, 'day ID');
    const index = itinerary.days.findIndex((d) => d._id.equals(requestedId));
    if (index === -1) throw new NotFoundException('Day not found');
    itinerary.days.splice(index, 1);
    this.recalculateDays(itinerary);
    itinerary.markModified('days');
    return itinerary.save();
  }

  async reorderDays(id: string, dto: ReorderDaysDto, userId: string) {
    const itinerary = await this.findOne(id, userId);
    const ids = dto.dayIds;
    const existing = itinerary.days.map((day) => day._id.toString());
    if (
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((dayId) => existing.includes(dayId))
    ) {
      throw new BadRequestException('dayIds must contain every existing day ID exactly once');
    }
    const byId = new Map(itinerary.days.map((day) => [day._id.toString(), day]));
    itinerary.days = ids.map((dayId) => byId.get(dayId)!);
    this.recalculateDays(itinerary);
    itinerary.markModified('days');
    return itinerary.save();
  }
  async addActivity(itineraryId: string, dayId: string, dto: CreateActivityDto, userId: string) {
    const itinerary = await this.findOne(itineraryId, userId);
    const dayObjectId = this.toObjectId(dayId, 'day ID');
    const day = itinerary.days.find((entry) => entry._id.equals(dayObjectId));
    if (!day) throw new NotFoundException('Day not found');

    if (!day.activities) day.activities = [];
    day.activities.push({
      _id: new Types.ObjectId(),
      name: dto.name,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.attractionId !== undefined ? { attractionId: dto.attractionId } : {}),
    });
    itinerary.markModified('days');
    return itinerary.save();
  }

  private async findActivityOwner(activityId: string, userId: string) {
    const activityObjectId = this.toObjectId(activityId, 'activity ID');
    const ownerId = this.toObjectId(userId, 'user ID');

    // Activity IDs live inside itinerary days. Search the owner's itineraries
    // and compare IDs directly so older embedded documents are also found.
    const itineraries = await this.itineraryModel.find({ ownerId }).exec();
    for (const itinerary of itineraries) {
      for (const day of itinerary.days ?? []) {
        const activity = (day.activities ?? []).find(
          (entry) => String(entry._id) === activityObjectId.toString(),
        );
        if (activity) return { itinerary, activity, day };
      }
    }

    throw new NotFoundException('Activity not found');
  }

  async updateActivity(activityId: string, dto: UpdateActivityDto, userId: string) {
    const { itinerary, activity } = await this.findActivityOwner(activityId, userId);
    if (dto.name !== undefined) activity.name = dto.name;
    if (dto.description !== undefined) activity.description = dto.description;
    if (dto.attractionId !== undefined) activity.attractionId = dto.attractionId;
    itinerary.markModified('days');
    return itinerary.save();
  }

  async removeActivity(activityId: string, userId: string) {
    const { itinerary, day } = await this.findActivityOwner(activityId, userId);
    const activityObjectId = this.toObjectId(activityId, 'activity ID');
    day.activities = day.activities.filter((entry) => !entry._id.equals(activityObjectId));
    itinerary.markModified('days');
    await itinerary.save();
    return { message: 'Activity deleted successfully' };
  }
  async addBudget(itineraryId: string, dayId: string, dto: CreateBudgetDto, userId: string) {
    const itinerary = await this.findOne(itineraryId, userId);
    const dayObjectId = this.toObjectId(dayId, 'day ID');
    const day = itinerary.days.find((entry) => entry._id.equals(dayObjectId));
    if (!day) throw new NotFoundException('Day not found');
    if (!day.budgets) day.budgets = [];
    day.budgets.push({ _id: new Types.ObjectId(), ...dto });
    itinerary.markModified('days');
    return itinerary.save();
  }

  private async findBudgetOwner(budgetId: string, userId: string) {
    const budgetObjectId = this.toObjectId(budgetId, 'budget ID');
    const ownerId = this.toObjectId(userId, 'user ID');
    const itinerary = await this.itineraryModel.findOne({ ownerId, 'days.budgets._id': budgetObjectId }).exec();
    if (!itinerary) throw new NotFoundException('Budget not found');
    for (const day of itinerary.days) {
      const budget = (day.budgets ?? []).find((entry) => entry._id.equals(budgetObjectId));
      if (budget) return { itinerary, day, budget };
    }
    throw new NotFoundException('Budget not found');
  }

  async updateBudget(budgetId: string, dto: UpdateBudgetDto, userId: string) {
    const { itinerary, budget } = await this.findBudgetOwner(budgetId, userId);
    if (dto.category !== undefined) budget.category = dto.category;
    if (dto.amount !== undefined) budget.amount = dto.amount;
    if (dto.currency !== undefined) budget.currency = dto.currency;
    if (dto.description !== undefined) budget.description = dto.description;
    itinerary.markModified('days');
    return itinerary.save();
  }

  async removeBudget(budgetId: string, userId: string) {
    const { itinerary, day } = await this.findBudgetOwner(budgetId, userId);
    const requested = this.toObjectId(budgetId, 'budget ID');
    day.budgets = (day.budgets ?? []).filter((item) => !item._id.equals(requested));
    itinerary.markModified('days');
    await itinerary.save();
    return { message: 'Budget deleted successfully' };
  }

  async addTransportCost(itineraryId: string, dto: CreateTransportCostDto, userId: string) {
    const itinerary = await this.findOne(itineraryId, userId);
    if (!itinerary.transportCosts) itinerary.transportCosts = [];
    itinerary.transportCosts.push({ _id: new Types.ObjectId(), ...dto });
    itinerary.markModified('transportCosts');
    return itinerary.save();
  }

  private async findTransportOwner(costId: string, userId: string) {
    const costObjectId = this.toObjectId(costId, 'transport cost ID');
    const ownerId = this.toObjectId(userId, 'user ID');
    const itinerary = await this.itineraryModel.findOne({ ownerId, 'transportCosts._id': costObjectId }).exec();
    if (!itinerary) throw new NotFoundException('Transport cost not found');
    const cost = (itinerary.transportCosts ?? []).find((entry) => entry._id.equals(costObjectId));
    if (!cost) throw new NotFoundException('Transport cost not found');
    return { itinerary, cost };
  }

  async updateTransportCost(costId: string, dto: UpdateTransportCostDto, userId: string) {
    const { itinerary, cost } = await this.findTransportOwner(costId, userId);
    if (dto.fromCityId !== undefined) cost.fromCityId = dto.fromCityId;
    if (dto.toCityId !== undefined) cost.toCityId = dto.toCityId;
    if (dto.amount !== undefined) cost.amount = dto.amount;
    if (dto.currency !== undefined) cost.currency = dto.currency;
    if (dto.description !== undefined) cost.description = dto.description;
    itinerary.markModified('transportCosts');
    return itinerary.save();
  }

  async removeTransportCost(costId: string, userId: string) {
    const { itinerary } = await this.findTransportOwner(costId, userId);
    const requested = this.toObjectId(costId, 'transport cost ID');
    itinerary.transportCosts = (itinerary.transportCosts ?? []).filter((entry) => !entry._id.equals(requested));
    itinerary.markModified('transportCosts');
    await itinerary.save();
    return { message: 'Transport cost deleted successfully' };
  }

  async budgetSummary(itineraryId: string, userId: string) {
    const itinerary = await this.findOne(itineraryId, userId);
    const totals: Record<string, number> = {};
    const byCategory: Record<string, Record<string, number>> = {};
    const add = (currency: string, category: string, amount: number) => {
      totals[currency] = (totals[currency] ?? 0) + amount;
      if (!byCategory[currency]) byCategory[currency] = {};
      byCategory[currency][category] = (byCategory[currency][category] ?? 0) + amount;
    };
    for (const day of itinerary.days) {
      for (const entry of day.budgets ?? []) add(entry.currency, entry.category, entry.amount);
    }
    for (const entry of itinerary.transportCosts ?? []) add(entry.currency, 'intercityTransportation', entry.amount);
    return {
      itineraryId: itinerary._id,
      totalsByCurrency: totals,
      categoriesByCurrency: byCategory,
      conversionApplied: false,
      note: 'Amounts in different currencies have not been combined. FXRatesAPI conversion is not implemented yet.',
    };
  }

  async convertedBudgetSummary(itineraryId: string, userId: string, currency: string) {
    // Check ownership before making an external API call.
    await this.findOne(itineraryId, userId);
    const target = currency?.toUpperCase();
    if (!target || !/^[A-Z]{3}$/.test(target)) {
      throw new BadRequestException('currency must be a three-letter ISO code, e.g. USD or EGP');
    }

    const summary = await this.budgetSummary(itineraryId, userId);
    const sourceTotals = summary.totalsByCurrency;
    const sourceCategories = summary.categoriesByCurrency;
    const sources = Object.keys(sourceTotals);
    if (sources.length === 0) {
      return {
        ...summary,
        targetCurrency: target,
        convertedTotal: 0,
        convertedCategories: {},
        conversionApplied: true,
        rateDate: null,
        note: 'No expenses have been recorded yet.',
      };
    }

    // All expenses are already in the requested currency: no external rates needed.
    if (sources.every((source) => source === target)) {
      return {
        ...summary,
        targetCurrency: target,
        convertedTotal: Math.round((sourceTotals[target] ?? 0) * 100) / 100,
        convertedCategories: sourceCategories[target] ?? {},
        conversionApplied: true,
        rateDate: null,
        note: 'No exchange-rate lookup was needed.',
      };
    }

    const rateData = await this.fxRatesService.getRates();
    const rates = rateData.rates!;
    const getRate = (code: string) => code === rateData.base ? 1 : rates[code];
    const targetRate = getRate(target);
    if (typeof targetRate !== 'number' || !Number.isFinite(targetRate) || targetRate <= 0) {
      throw new BadGatewayException(`FXRatesAPI has no valid rate for ${target}`);
    }
    const convert = (amount: number, source: string) => {
      const sourceRate = getRate(source);
      if (typeof sourceRate !== 'number' || !Number.isFinite(sourceRate) || sourceRate <= 0) {
        throw new BadGatewayException(`FXRatesAPI has no valid rate for ${source}`);
      }
      return (amount / sourceRate) * targetRate;
    };
    let total = 0;
    const categories: Record<string, number> = {};
    for (const source of sources) {
      total += convert(sourceTotals[source], source);
      for (const [category, amount] of Object.entries(sourceCategories[source] ?? {})) {
        categories[category] = (categories[category] ?? 0) + convert(amount, source);
      }
    }
    const roundedCategories: Record<string, number> = {};
    for (const [category, amount] of Object.entries(categories)) {
      roundedCategories[category] = Math.round(amount * 100) / 100;
    }
    return {
      ...summary,
      targetCurrency: target,
      convertedTotal: Math.round(total * 100) / 100,
      convertedCategories: roundedCategories,
      conversionApplied: true,
      rateDate: rateData.date ?? (rateData.timestamp ? new Date(rateData.timestamp * 1000).toISOString() : null),
      note: 'Converted using FXRatesAPI latest rates; results are estimates.',
    };
  }

  async addActivityImage(activityId: string, filename: string, userId: string) {
    const { itinerary, activity } = await this.findActivityOwner(activityId, userId);
    if (!activity.images) activity.images = [];
    const image = { _id: new Types.ObjectId(), url: `/api/activities/images/${filename}`, filename };
    activity.images.push(image);
    itinerary.markModified('days');
    await itinerary.save();
    return image;
  }

  async removeActivityImage(activityId: string, imageId: string, userId: string) {
    const { itinerary, activity } = await this.findActivityOwner(activityId, userId);
    const id = this.toObjectId(imageId, 'image ID');
    const images = activity.images ?? [];
    if (!images.some(image => image._id.equals(id))) throw new NotFoundException('Image not found');
    activity.images = images.filter(image => !image._id.equals(id));
    itinerary.markModified('days');
    await itinerary.save();
    // Keep the uploaded file because cloned itineraries may reference it.
    return { message: 'Activity image removed' };
  }

  async searchPublic(query: { q?: string; country?: string; page?: string; limit?: string }) {
    const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 10));
    const filter: Record<string, unknown> = { isPublic: true };
    if (query.q?.trim()) {
      const safe = query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: safe, $options: 'i' };
    }
    if (query.country?.trim()) filter.countries = query.country.trim().toUpperCase();
    const [items, total] = await Promise.all([
      this.itineraryModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.itineraryModel.countDocuments(filter).exec(),
    ]);
    return { items, total, page, limit };
  }

  async findPublic(id: string) {
    const _id = this.toObjectId(id, 'itinerary ID');
    const item = await this.itineraryModel.findOne({ _id, isPublic: true }).lean().exec();
    if (!item) throw new NotFoundException('Public itinerary not found');
    return item;
  }

  async clonePublic(id: string, userId: string) {
    const source = await this.findPublic(id);
    const ownerId = this.toObjectId(userId, 'user ID');
    const days = (source.days ?? []).map((day) => ({
      dayNumber: day.dayNumber, cityId: day.cityId, date: day.date,
      _id: new Types.ObjectId(),
      activities: (day.activities ?? []).map((activity) => ({
        name: activity.name, description: activity.description, attractionId: activity.attractionId,
        images: (activity.images ?? []).map(img => ({ _id: new Types.ObjectId(), url: img.url, filename: img.filename })),
        _id: new Types.ObjectId(),
      })),
      budgets: (day.budgets ?? []).map((budget) => ({
        category: budget.category, amount: budget.amount, currency: budget.currency,
        description: budget.description, _id: new Types.ObjectId(),
      })),
    }));
    return this.itineraryModel.create({
      ownerId, title: source.title, countries: source.countries, startDate: source.startDate,
      isPublic: false, clonedFrom: source._id, days,
      transportCosts: (source.transportCosts ?? []).map((cost) => ({
        fromCityId: cost.fromCityId, toCityId: cost.toCityId,
        amount: cost.amount, currency: cost.currency, description: cost.description,
        _id: new Types.ObjectId(),
      })),
    });
  }

}
