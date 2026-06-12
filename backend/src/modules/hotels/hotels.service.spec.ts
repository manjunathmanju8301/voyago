import { Test, TestingModule } from '@nestjs/testing';
import { HotelsService } from './hotels.service.js';
import { ConfigService } from '@nestjs/config';
import { GeocodingHelper } from '@/common/helpers/geocoding.helper.js';
import { getLoggerToken } from 'nestjs-pino';

describe('HotelsService', () => {
  let service: HotelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelsService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn(),
          },
        },
        {
          provide: GeocodingHelper,
          useValue: {
            getCityCoordinates: vi.fn(),
          },
        },
        {
          provide: getLoggerToken(HotelsService.name),
          useValue: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HotelsService>(HotelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
