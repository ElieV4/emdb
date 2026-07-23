import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

type UserRecord = NonNullable<Awaited<ReturnType<PrismaService['users']['findUnique']>>>;
export type AuthenticatedUser = Omit<UserRecord, 'password_hash'>;

interface AuthResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUserCredentials(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async login(user: AuthenticatedUser): Promise<AuthResponse> {
    return {
      user,
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
    };
  }

  async register(email: string, pseudo: string, password: string): Promise<AuthResponse> {
    const existingByEmail = await this.prisma.users.findUnique({ where: { email } });
    if (existingByEmail) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const existingByPseudo = await this.prisma.users.findUnique({ where: { pseudo } });
    if (existingByPseudo) {
      throw new ConflictException('Ce pseudo est déjà utilisé.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.users.create({
      data: {
        email,
        pseudo,
        password_hash: passwordHash,
      },
    });

    const safeUser = this.sanitizeUser(user);
    return {
      user: safeUser,
      accessToken: await this.signAccessToken(safeUser),
      refreshToken: await this.signRefreshToken(safeUser),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; email: string; pseudo: string }>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });

      const user = await this.prisma.users.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('Jeton de rafraîchissement invalide');
      }

      const safeUser = this.sanitizeUser(user);
      return {
        user: safeUser,
        accessToken: await this.signAccessToken(safeUser),
        refreshToken: await this.signRefreshToken(safeUser),
      };
    } catch {
      throw new UnauthorizedException('Jeton de rafraîchissement invalide');
    }
  }

  async logout(): Promise<void> {
    return;
  }

  private async signAccessToken(user: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email, pseudo: user.pseudo });
  }

  private async signRefreshToken(user: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, pseudo: user.pseudo },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: '7d',
      },
    );
  }

  private getRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET', 'emdb_default_refresh_secret');
  }

  private sanitizeUser(user: UserRecord): AuthenticatedUser {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
}
