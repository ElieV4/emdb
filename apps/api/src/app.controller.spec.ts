import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = moduleRef.get<AppController>(AppController);
  });

  it('renvoie un statut ok sur /health', () => {
    expect(controller.health()).toEqual({ status: 'ok', service: 'emdb-api' });
  });
});
