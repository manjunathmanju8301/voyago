import { Test, TestingModule } from '@nestjs/testing';
import { HotelsController } from './hotels.controller.js';
import { HotelsService } from './hotels.service.js';

describe('HotelsController', () => {
  let controller: HotelsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HotelsController],
      providers: [
        {
          provide: HotelsService,
          useValue: {
            searchHotels: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HotelsController>(HotelsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
