import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

/**
 * Guard vérifiant que l'utilisateur connecté fait partie des ADMIN_EMAILS
 * définis dans le fichier `.env`.
 *
 * Utilisation :
 * ```typescript
 * @UseGuards(JwtAuthGuard, AdminGuard)
 * @Post('refresh-materialized-views')
 * ```
 *
 * L'ordre est important : JwtAuthGuard doit s'exécuter en premier pour
 * que req.user soit peuplé.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.email) {
      throw new UnauthorizedException('Authentification requise pour accéder à cette ressource.');
    }

    const adminEmailsEnv = this.configService.get<string>('ADMIN_EMAILS', '');
    const adminEmails = adminEmailsEnv
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.length === 0) {
      // Aucun admin configuré = accès refusé par défaut (sécurité)
      throw new UnauthorizedException(
        "Aucun administrateur n'est configuré. Définissez ADMIN_EMAILS dans .env.",
      );
    }

    if (!adminEmails.includes(user.email.toLowerCase())) {
      throw new UnauthorizedException('Accès réservé aux administrateurs.');
    }

    return true;
  }
}
