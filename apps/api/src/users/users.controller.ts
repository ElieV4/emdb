import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SetAvatarUrlDto } from './dto/upload-avatar.dto';

/**
 * Contrôleur des endpoints utilisateurs (Phase 3.2).
 *
 * Tous les endpoints nécessitent une authentification JWT, sauf indication contraire.
 *
 * Endpoints :
 * - GET    /users/me              — profil complet de l'utilisateur connecté
 * - PATCH  /users/me              — mise à jour du pseudo et/ou avatar_url
 * - POST   /users/me/avatar       — upload d'un avatar via multer
 * - GET    /users/search?q=       — recherche par pseudo/email (pour le partage de listes)
 * - DELETE /users/me              — suppression du compte (cascade gérée par la BDD)
 */
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/me
   * Retourne le profil complet de l'utilisateur connecté.
   */
  @Get('me')
  async me(@CurrentUser() user: any) {
    return this.usersService.getById(user.id);
  }

  /**
   * PATCH /users/me
   * Met à jour le pseudo et/ou l'URL de l'avatar.
   */
  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() payload: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, payload);
  }

  /**
   * POST /users/me/avatar
   * Télécharge un avatar via multer (multipart/form-data).
   *
   * Le fichier est reçu via le champ `file` du formulaire.
   * En développement, le fichier est stocké localement dans `uploads/avatars/`.
   * En production, le stockage peut être remplacé (S3, etc.) — le principe reste
   * le même : multer reçoit le fichier, on construit l'URL, on la persiste.
   *
   * Alternativement, un client peut fournir directement une `avatar_url` via le body
   * (SetAvatarUrlDto) si le stockage est géré côté client.
   */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.match(/^image\/(jpeg|png|webp|gif|avif)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Seules les images sont autorisées (jpeg, png, webp, gif, avif).'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SetAvatarUrlDto,
  ) {
    // Si un fichier a été uploadé, construire l'URL depuis le chemin stocké par multer.
    if (file) {
      const avatarUrl = `/uploads/avatars/${file.filename}`;
      return this.usersService.updateAvatar(user.id, avatarUrl);
    }

    // Sinon, utiliser une URL fournie directement dans le body.
    if (body?.avatar_url) {
      return this.usersService.updateAvatar(user.id, body.avatar_url);
    }

    // Aucun fichier ni URL fournie.
    return { error: 'Aucun fichier ou URL fourni.' };
  }

  /**
   * GET /users/search?q=
   * Recherche un utilisateur par pseudo ou email.
   * Nécessaire pour le partage de listes (list_shares).
   */
  @Get('search')
  async search(@Query() query: SearchUsersDto) {
    return this.usersService.findByPseudoOrEmail(query.query);
  }

  /**
   * DELETE /users/me
   * Supprime le compte de l'utilisateur connecté.
   * Toutes les données associées sont supprimées en cascade
   * via les clés étrangères ON DELETE CASCADE du schéma.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: any): Promise<void> {
    await this.usersService.delete(user.id);
  }
}
