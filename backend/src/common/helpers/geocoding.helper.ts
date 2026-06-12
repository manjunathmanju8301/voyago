import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { ICityCoordinates, IGeoapifyResponse } from '@/types/index.js';

@Injectable()
export class GeocodingHelper {
    private readonly logger = new Logger(GeocodingHelper.name);

    constructor(private readonly configService: ConfigService) {}

    async getCityCoordinates(city: string): Promise<ICityCoordinates> {
        const apiKey = this.configService.get<string>('GEOAPIFY_API_KEY');
        if (!apiKey) {
            this.logger.error('GEOAPIFY_API_KEY is not defined in environment configuration');
            throw new BadRequestException('Failed to fetch location data');
        }

        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city)}&lang=en&apiKey=${apiKey}`;

        try {
            const response = await axios.get<IGeoapifyResponse>(url);
            const feature = response.data.features?.[0];

            if (!feature || !feature.properties) {
                throw new NotFoundException('City not found');
            }

            const { lat, lon, city: parsedCity, state, country } = feature.properties;
            if (lat === undefined || lon === undefined) {
                throw new NotFoundException('City not found');
            }

            return {
                lat: Number(lat),
                lon: Number(lon),
                city: parsedCity || '',
                state: state || '',
                country: country || '',
            };
        } catch (error: unknown) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to fetch geocoding data for city "${city}": ${message}`);
            throw new BadRequestException('Failed to fetch location data');
        }
    }
}
