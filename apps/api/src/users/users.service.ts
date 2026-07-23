import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        pseudo: true,
        avatar_url: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return user;
  }

  async updateProfile(id: string, payload: UpdateUserDto) {
    return this.prisma.users.update({
      where: { id },
      data: {
        pseudo: payload.pseudo,
        avatar_url: payload.avatar_url,
      },
      select: {
        id: true,
        email: true,
        pseudo: true,
        avatar_url: true,
        created_at: true,
      },
    });
  }

  async search(query: string) {
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
}
