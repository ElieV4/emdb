import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const prismaServiceMock = {
  users: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const mockUser: any = {
    id: 'user-id',
    email: 'test@example.com',
    pseudo: 'testuser',
    password_hash: 'hashed-password',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    avatar_url: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '15m' } }),
      ],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('validateUserCredentials returns user for valid credentials', async () => {
    (prismaServiceMock.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const validated = await service.validateUserCredentials('test@example.com', 'password');

    expect(validated).toMatchObject({
      id: 'user-id',
      email: 'test@example.com',
      pseudo: 'testuser',
    });
  });

  it('validateUserCredentials returns null for invalid password', async () => {
    (prismaServiceMock.users.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const validated = await service.validateUserCredentials('test@example.com', 'wrong-password');

    expect(validated).toBeNull();
  });
});
