import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type UserRecord = NonNullable<Awaited<ReturnType<PrismaService['users']['findUnique']>>>;
export type AuthenticatedUser = Omit<UserRecord, 'password_hash'>;

interface JwtPayload {
  sub: string;
  email: string;
  pseudo: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET', 'emdb_default_jwt_secret'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.users.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Token invalide');
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}
