import { IsOptional, IsString } from 'class-validator';

// Query accepted by GET /clientes (D58). Trimming is applied by the query
// service, which owns the search semantics.
export class SearchCustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
