import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: any) {
    return this.usersService.getById(user.id);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: any, @Body() payload: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, payload);
  }

  @Get('search')
  async search(@Query() query: SearchUsersDto) {
    return this.usersService.search(query.query);
  }
}
