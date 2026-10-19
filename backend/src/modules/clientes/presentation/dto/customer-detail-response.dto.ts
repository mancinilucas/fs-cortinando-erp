import { CustomerAddressDto } from './customer-address.dto.js';

// Public detail response (D60). deletedAt is internal and never exposed.
export class CustomerDetailResponseDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  address: CustomerAddressDto | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
