import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  titles: {
    findUnique: jest.fn(),
  },
  credits: {
    findMany: jest.fn(),
  },
};

describe('CreditsService', () => {
  let service: CreditsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditsService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
    jest.clearAllMocks();
  });

  describe('getTitleCredits', () => {
    it('retourne les credits groupés par rôle', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });

      prismaServiceMock.credits.findMany.mockResolvedValue([
        {
          id: 'credit-1',
          personnage: 'Hero',
          ordre: 0,
          people: {
            id: 'person-1',
            tmdb_id: 100,
            nom: 'Alice',
            photo_url: 'https://example.com/alice.jpg',
          },
          roles: { code: 'acteur', libelle: 'Acteur' },
        },
        {
          id: 'credit-2',
          personnage: null,
          ordre: null,
          people: {
            id: 'person-2',
            tmdb_id: 200,
            nom: 'Bob',
            photo_url: null,
          },
          roles: { code: 'realisateur', libelle: 'Réalisateur' },
        },
        {
          id: 'credit-3',
          personnage: 'Villain',
          ordre: 1,
          people: {
            id: 'person-3',
            tmdb_id: 300,
            nom: 'Charlie',
            photo_url: null,
          },
          roles: { code: 'acteur', libelle: 'Acteur' },
        },
      ]);

      const result = await service.getTitleCredits('title-1');

      expect(result).toHaveProperty('Acteur');
      expect(result).toHaveProperty('Réalisateur');

      // Acteur doit contenir 2 entrées, triées par ordre
      expect(result.Acteur).toHaveLength(2);
      expect(result.Acteur[0].personne.nom).toBe('Alice');
      expect(result.Acteur[0].ordre).toBe(0);
      expect(result.Acteur[1].personne.nom).toBe('Charlie');
      expect(result.Acteur[1].ordre).toBe(1);

      // Réalisateur doit contenir 1 entrée
      expect(result.Réalisateur).toHaveLength(1);
      expect(result.Réalisateur[0].personne.nom).toBe('Bob');

      // Vérifier que seuls les credits sans episode_id sont récupérés
      expect(prismaServiceMock.credits.findMany).toHaveBeenCalledWith({
        where: { title_id: 'title-1', episode_id: null },
        include: expect.any(Object),
        orderBy: { ordre: 'asc' },
      });
    });

    it('retourne un objet vide si aucun credit', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: 'title-1' });
      prismaServiceMock.credits.findMany.mockResolvedValue([]);

      const result = await service.getTitleCredits('title-1');

      expect(result).toEqual({});
    });

    it("lève NotFoundException si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.getTitleCredits('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
