import { GeocodingHelper } from '@/common/index.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SearchHotelsDto } from './dto/index.js';
import axios from 'axios';
import type { IHotelSearchResponse, IHotelResult } from './types/index.js';
import type { IGeoapifyPlacesResponse } from '@/types/index.js';

@Injectable()
export class HotelsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly geocodingHelper: GeocodingHelper,
        @InjectPinoLogger(HotelsService.name)
        private readonly logger: PinoLogger,
    ) {}

    async searchHotels(dto: SearchHotelsDto): Promise<IHotelSearchResponse> {
        const { city, limit, checkIn, checkOut, guests } = dto;
        const coordinates = await this.geocodingHelper.getCityCoordinates(city);

        const geoAPIkey = this.configService.get<string>('GEOAPIFY_API_KEY');
        if (!geoAPIkey) {
            this.logger.error('GEOAPIFY_API_KEY is not defined');
            throw new BadRequestException('Failed to fetch location data');
        }

        const LIMIT = limit ?? 20;
        const url = `https://api.geoapify.com/v2/places?categories=accommodation.hotel&filter=circle:${coordinates.lon},${coordinates.lat},10000&limit=${LIMIT}&lang=en&apiKey=${geoAPIkey}`;

        try {
            const response = await axios.get<IGeoapifyPlacesResponse>(url);
            const features = response.data.features || [];

            const hotels: IHotelResult[] = features.map((feature) => {
                const props = feature.properties;
                return {
                    placeId: props.place_id,
                    name: props.name ?? null,
                    address: props.formatted,
                    addressLine1: props.address_line1,
                    addressLine2: props.address_line2,
                    city: props.city ?? null,
                    state: props.state ?? null,
                    country: props.country,
                    lat: props.lat,
                    lon: props.lon,
                    categories: props.categories || [],
                };
            });

            return {
                hotels,
                total: features.length,
                city: coordinates.city,
                checkIn,
                checkOut,
                guests: guests ?? 1,
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Geoapify Places API call failed: ${msg}`);
            throw new BadRequestException('Failed to fetch location data');
        }
    }
}
