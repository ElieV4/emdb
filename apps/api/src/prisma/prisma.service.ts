import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@emdb/db';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  users = prisma.users;

  onModuleDestroy() {
    return prisma.$disconnect();
  }
}
