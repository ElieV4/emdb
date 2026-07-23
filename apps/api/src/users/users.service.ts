import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Sélection de champs publics exposés par les endpoints utilisateurs.
 * Le `password_hash` n'est jamais inclus.
 */
const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  pseudo: true,
  avatar_url: true,
  created_at: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le profil public d'un utilisateur par son ID.
   * @throws NotFoundException si l'utilisateur n'existe pas.
   */
  async getById(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return user;
  }

  /**
   * Met à jour le profil (pseudo et/ou avatar_url) d'un utilisateur.
   * @throws NotFoundException si l'utilisateur n'existe pas.
   */
  async updateProfile(id: string, payload: UpdateUserDto) {
    return this.prisma.users.update({
      where: { id },
      data: {
        pseudo: payload.pseudo,
        avatar_url: payload.avatar_url,
      },
      select: USER_PUBLIC_SELECT,
    });
  }

  /**
   * Met à jour l'URL de l'avatar d'un utilisateur.
   * Appelé après un upload via multer (POST /users/me/avatar).
   * @throws NotFoundException si l'utilisateur n'existe pas.
   */
  async updateAvatar(id: string, avatarUrl: string) {
    return this.prisma.users.update({
      where: { id },
      data: { avatar_url: avatarUrl },
      select: USER_PUBLIC_SELECT,
    });
  }

  /**
   * Recherche un utilisateur par pseudo ou email (insensible à la casse).
   * Nécessaire pour la fonctionnalité de partage de listes :
   * il faut pouvoir trouver l'autre utilisateur.
   *
   * @param query - Fragment de pseudo ou email à rechercher.
   * @returns Liste des utilisateurs correspondants (max 20).
   */
  async findByPseudoOrEmail(query: string) {
    return this.prisma.users.findMany({
      where: {
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { pseudo: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        avatar_url: true,
      },
      take: 20,
    });
  }

  /**
   * Alias de findByPseudoOrEmail pour la route GET /users/search.
   * Conservé pour la compatibilité avec le contrôleur existant.
   */
  async search(query: string) {
    return this.findByPseudoOrEmail(query);
  }

  /**
   * Supprime un utilisateur et toutes ses données associées.
   * La suppression en cascade est gérée par les clés étrangères
   * ON DELETE CASCADE définies dans le schéma (db_init.sql).
   * @throws NotFoundException si l'utilisateur n'existe pas.
   */
  async delete(id: string): Promise<void> {
    await this.prisma.users.delete({
      where: { id },
    });
  }
}
