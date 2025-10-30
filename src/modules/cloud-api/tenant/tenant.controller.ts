import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';

@Controller()
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

  constructor(private readonly tenantService: TenantService) {}

  /**
   * Create a new tenant
   * POST /tenants
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createTenantDto: CreateTenantDto,
  ): Promise<TenantResponseDto> {
    this.logger.log(`POST /tenants - Creating tenant: ${createTenantDto.subdomain}`);
    return await this.tenantService.create(createTenantDto);
  }

  /**
   * Get all tenants
   * GET /tenants
   */
  @Get()
  async findAll(): Promise<TenantResponseDto[]> {
    this.logger.log('GET /tenants - Fetching all tenants');
    return await this.tenantService.findAll();
  }

  /**
   * Get tenant by ID
   * GET /tenants/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<TenantResponseDto> {
    this.logger.log(`GET /tenants/${id} - Fetching tenant by ID`);
    return await this.tenantService.findById(id);
  }

  /**
   * Get tenant by subdomain
   * GET /tenants/subdomain/:subdomain
   */
  @Get('subdomain/:subdomain')
  async findBySubdomain(
    @Param('subdomain') subdomain: string,
  ): Promise<TenantResponseDto> {
    this.logger.log(
      `GET /tenants/subdomain/${subdomain} - Fetching tenant by subdomain`,
    );
    return await this.tenantService.findBySubdomain(subdomain);
  }

  /**
   * Update tenant
   * PATCH /tenants/:id
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    this.logger.log(`PATCH /tenants/${id} - Updating tenant`);
    return await this.tenantService.update(id, updateTenantDto);
  }

  /**
   * Archive tenant (soft delete)
   * DELETE /tenants/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id') id: string): Promise<TenantResponseDto> {
    this.logger.log(`DELETE /tenants/${id} - Archiving tenant`);
    return await this.tenantService.archive(id);
  }
}
