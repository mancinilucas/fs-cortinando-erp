import type { BusinessDataRecord } from '../application/business-data-store.js';
import type { BusinessDataResponseDto } from './dto/business-data-response.dto.js';

// Keeps the HTTP contract separate from the application record and exposes the
// persistence-managed timestamp as ISO 8601 (D131).
export class BusinessDataResponseMapper {
  static toResponse(record: BusinessDataRecord): BusinessDataResponseDto {
    return {
      commercialNameOrConsultant: record.commercialNameOrConsultant,
      phone: record.phone,
      email: record.email,
      taxId: record.taxId,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
