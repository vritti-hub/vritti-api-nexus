import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Create a new user
   * @param createUserDto - User creation data
   * @param passwordHash - Optional pre-hashed password (hashed by encryption service)
   */
  async create(
    createUserDto: CreateUserDto,
    passwordHash?: string,
  ): Promise<UserResponseDto> {
    // Validate email uniqueness
    const existingUser = await this.userRepository.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ConflictException(
        `User with email '${createUserDto.email}' already exists`,
      );
    }

    // Create user
    const user = await this.userRepository.create({
      ...createUserDto,
      passwordHash,
    });

    this.logger.log(`Created user: ${user.email} (${user.id})`);

    return UserResponseDto.fromPrisma(user);
  }

  /**
   * Get all users
   */
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();
    return users.map((user) => UserResponseDto.fromPrisma(user));
  }

  /**
   * Get user by ID
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return UserResponseDto.fromPrisma(user);
  }

  /**
   * Get user by email (returns Prisma User for internal use)
   */
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  /**
   * Get user by phone (returns Prisma User for internal use)
   */
  async findByPhone(phone: string): Promise<User | null> {
    return await this.userRepository.findByPhone(phone);
  }

  /**
   * Update user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Check if user exists
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    // Update user
    const user = await this.userRepository.update(id, updateUserDto);

    this.logger.log(`Updated user: ${user.email} (${user.id})`);

    return UserResponseDto.fromPrisma(user);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.updateLastLogin(id);
    this.logger.debug(`Updated last login for user: ${id}`);
  }

  /**
   * Mark email as verified
   */
  async markEmailVerified(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.markEmailVerified(id);
    this.logger.log(
      `Marked email verified for user: ${user.email} (${user.id})`,
    );
    return UserResponseDto.fromPrisma(user);
  }

  /**
   * Mark phone as verified
   */
  async markPhoneVerified(
    id: string,
    phone: string,
    phoneCountry: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.markPhoneVerified(
      id,
      phone,
      phoneCountry,
    );
    this.logger.log(
      `Marked phone verified for user: ${user.email} (${user.id})`,
    );
    return UserResponseDto.fromPrisma(user);
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(id: string): Promise<UserResponseDto> {
    // Check if user exists
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    const user = await this.userRepository.delete(id);

    this.logger.log(`Deactivated user: ${user.email} (${user.id})`);

    return UserResponseDto.fromPrisma(user);
  }
}
