import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  users: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  const mockUser: any = {
    id: 'user-id',
    email: 'test@example.com',
    pseudo: 'testuser',
    avatar_url: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('retourne le profil public si l’utilisateur existe', async () => {
      prismaServiceMock.users.findUnique.mockResolvedValue(mockUser);

      const result = await service.getById('user-id');

      expect(result).toEqual(mockUser);
      expect(prismaServiceMock.users.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        select: { id: true, email: true, pseudo: true, avatar_url: true, created_at: true },
      });
    });

    it('lève NotFoundException si l’utilisateur n’existe pas', async () => {
      prismaServiceMock.users.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('met à jour le pseudo et l’avatar_url', async () => {
      const updatedUser = { ...mockUser, pseudo: 'newpseudo', avatar_url: 'https://example.com/avatar.png' };
      prismaServiceMock.users.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-id', {
        pseudo: 'newpseudo',
        avatar_url: 'https://example.com/avatar.png',
      });

      expect(result.pseudo).toBe('newpseudo');
      expect(result.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('met à jour uniquement le pseudo si avatar_url est absent', async () => {
      const updatedUser = { ...mockUser, pseudo: 'newpseudo' };
      prismaServiceMock.users.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-id', { pseudo: 'newpseudo' });

      expect(result.pseudo).toBe('newpseudo');
    });
  });

  describe('updateAvatar', () => {
    it('met à jour l’URL de l’avatar', async () => {
      const updatedUser = { ...mockUser, avatar_url: '/uploads/avatars/avatar.png' };
      prismaServiceMock.users.update.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar('user-id', '/uploads/avatars/avatar.png');

      expect(result.avatar_url).toBe('/uploads/avatars/avatar.png');
      expect(prismaServiceMock.users.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: { avatar_url: '/uploads/avatars/avatar.png' },
        select: { id: true, email: true, pseudo: true, avatar_url: true, created_at: true },
      });
    });
  });

  describe('findByPseudoOrEmail', () => {
    it('recherche par pseudo ou email insensible à la casse', async () => {
      const users = [
        { id: '1', email: 'user1@example.com', pseudo: 'user1', avatar_url: null },
        { id: '2', email: 'user2@example.com', pseudo: 'user2', avatar_url: null },
      ];
      prismaServiceMock.users.findMany.mockResolvedValue(users);

      const result = await service.findByPseudoOrEmail('user');

      expect(result).toHaveLength(2);
      expect(prismaServiceMock.users.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'user', mode: 'insensitive' } },
            { pseudo: { contains: 'user', mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, pseudo: true, avatar_url: true },
        take: 20,
      });
    });

    it('retourne un tableau vide si aucun résultat', async () => {
      prismaServiceMock.users.findMany.mockResolvedValue([]);

      const result = await service.findByPseudoOrEmail('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    it('est un alias de findByPseudoOrEmail', async () => {
      const users = [{ id: '1', email: 'user1@example.com', pseudo: 'user1', avatar_url: null }];
      prismaServiceMock.users.findMany.mockResolvedValue(users);

      const result = await service.search('user1');

      expect(result).toEqual(users);
    });
  });

  describe('delete', () => {
    it('supprime l’utilisateur', async () => {
      prismaServiceMock.users.delete.mockResolvedValue({});

      await service.delete('user-id');

      expect(prismaServiceMock.users.delete).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('propage l’erreur si l’utilisateur n’existe pas', async () => {
      prismaServiceMock.users.delete.mockRejectedValue(
        new Error('No user found'),
      );

      await expect(service.delete('nonexistent')).rejects.toThrow('No user found');
    });
  });
});
