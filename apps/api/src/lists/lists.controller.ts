import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { AddItemDto } from './dto/add-item.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ShareListDto } from './dto/share-list.dto';

/**
 * Contrôleur du module lists (Phase 4.3).
 *
 * Tous les endpoints nécessitent une authentification JWT.
 *
 * Endpoints user_lists (5) :
 * - POST   /lists                       — Créer une liste
 * - GET    /lists                       — Liste des listes de l'utilisateur
 * - GET    /lists/:id                   — Détail d'une liste avec ses items
 * - PATCH  /lists/:id                   — Modifier nom/description
 * - DELETE /lists/:id                   — Supprimer une liste
 *
 * Endpoints list_items (3) :
 * - POST   /lists/:listId/items         — Ajouter un titre
 * - DELETE /lists/:listId/items/:titleId — Retirer un titre
 * - PATCH  /lists/:listId/items/reorder — Réordonnancement batch
 *
 * Endpoints list_shares (4) :
 * - POST   /lists/:listId/shares                    — Partager une liste
 * - GET    /lists/:listId/shares                    — Liste des partages
 * - DELETE /lists/:listId/shares/:sharedWithUserId  — Retirer un partage
 * - GET    /shared-lists                            — Listes partagées avec moi
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  // ======================================================================
  // USER_LISTS
  // ======================================================================

  /**
   * POST /lists
   * Crée une nouvelle liste.
   */
  @Post('lists')
  async createList(@CurrentUser() user: any, @Body() dto: CreateListDto) {
    return this.listsService.createList(user.id, dto);
  }

  /**
   * GET /lists
   * Liste des listes de l'utilisateur connecté.
   */
  @Get('lists')
  async getUserLists(@CurrentUser() user: any) {
    return this.listsService.getUserLists(user.id);
  }

  /**
   * GET /lists/:id
   * Détail d'une liste avec ses items (titles).
   */
  @Get('lists/:id')
  async getListDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.listsService.getListDetail(id, user.id);
  }

  /**
   * PATCH /lists/:id
   * Modifie le nom et/ou la description d'une liste.
   */
  @Patch('lists/:id')
  async updateList(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.listsService.updateList(id, user.id, dto);
  }

  /**
   * DELETE /lists/:id
   * Supprime une liste (cascade).
   */
  @Delete('lists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteList(@CurrentUser() user: any, @Param('id') id: string): Promise<void> {
    await this.listsService.deleteList(id, user.id);
  }

  // ======================================================================
  // LIST_ITEMS
  // ======================================================================

  /**
   * POST /lists/:listId/items
   * Ajoute un titre à une liste.
   */
  @Post('lists/:listId/items')
  async addItem(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Body() dto: AddItemDto,
  ) {
    return this.listsService.addItem(listId, user.id, dto.title_id);
  }

  /**
   * DELETE /lists/:listId/items/:titleId
   * Retire un titre d'une liste.
   */
  @Delete('lists/:listId/items/:titleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Param('titleId') titleId: string,
  ): Promise<void> {
    await this.listsService.removeItem(listId, user.id, titleId);
  }

  /**
   * PATCH /lists/:listId/items/reorder
   * Réordonnancement batch des items.
   */
  @Patch('lists/:listId/items/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderItems(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Body() dto: ReorderDto,
  ): Promise<void> {
    await this.listsService.reorderItems(listId, user.id, dto);
  }

  // ======================================================================
  // LIST_SHARES
  // ======================================================================

  /**
   * POST /lists/:listId/shares
   * Partage une liste avec un autre utilisateur.
   */
  @Post('lists/:listId/shares')
  async shareList(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Body() dto: ShareListDto,
  ) {
    return this.listsService.shareList(listId, user.id, dto);
  }

  /**
   * GET /lists/:listId/shares
   * Liste des partages d'une liste.
   */
  @Get('lists/:listId/shares')
  async getShares(@CurrentUser() user: any, @Param('listId') listId: string) {
    return this.listsService.getShares(listId, user.id);
  }

  /**
   * DELETE /lists/:listId/shares/:sharedWithUserId
   * Retire un partage.
   */
  @Delete('lists/:listId/shares/:sharedWithUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeShare(
    @CurrentUser() user: any,
    @Param('listId') listId: string,
    @Param('sharedWithUserId') sharedWithUserId: string,
  ): Promise<void> {
    await this.listsService.removeShare(listId, user.id, sharedWithUserId);
  }

  /**
   * GET /shared-lists
   * Listes partagées avec l'utilisateur connecté.
   */
  @Get('shared-lists')
  async getSharedLists(@CurrentUser() user: any) {
    return this.listsService.getSharedLists(user.id);
  }
}
