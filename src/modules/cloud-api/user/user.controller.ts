import { Controller, Get, Param, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * User Controller
 * Note: This controller provides basic read operations for internal use.
 * User creation/update is handled by Onboarding and Auth modules.
 */
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * Get all users (admin/internal use)
   * GET /users
   */
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    this.logger.log('GET /users - Fetching all users');
    return await this.userService.findAll();
  }

  /**
   * Get user by ID
   * GET /users/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<UserResponseDto> {
    this.logger.log(`GET /users/${id} - Fetching user by ID`);
    return await this.userService.findById(id);
  }
}
