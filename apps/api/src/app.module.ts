import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { TitlesModule } from './titles/titles.module';
import { PeopleModule } from './people/people.module';
import { SeasonsEpisodesModule } from './seasons-episodes/seasons-episodes.module';
import { CreditsModule } from './credits/credits.module';
import { DatavizModule } from './dataviz/dataviz.module';
import { WatchesModule } from './watches/watches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    TitlesModule,
    PeopleModule,
    SeasonsEpisodesModule,
    CreditsModule,
    DatavizModule,
    WatchesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
