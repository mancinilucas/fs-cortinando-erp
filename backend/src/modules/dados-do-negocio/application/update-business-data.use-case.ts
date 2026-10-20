import { Injectable } from '@nestjs/common';
import {
  BusinessDataInput,
  normalizeBusinessDataValues,
} from './business-data-normalizers.js';
import {
  BusinessDataRecord,
  BusinessDataStore,
} from './business-data-store.js';
import { BusinessDataValidationError } from './business-data-validation.error.js';

// Pragmatic structural check. It mirrors the DTO validation and does not
// verify deliverability (D132).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_ID_PATTERN = /^(\d{11}|\d{14})$/;

@Injectable()
export class UpdateBusinessDataUseCase {
  constructor(private readonly businessData: BusinessDataStore) {}

  async execute(input: BusinessDataInput): Promise<BusinessDataRecord> {
    const values = normalizeBusinessDataValues(input);

    validate(values);

    return this.businessData.upsert(values);
  }
}

function validate(
  values: ReturnType<typeof normalizeBusinessDataValues>,
): void {
  if (values.commercialNameOrConsultant === '') {
    throw new BusinessDataValidationError(
      'Commercial name or consultant is required',
    );
  }

  if (values.phone === '') {
    throw new BusinessDataValidationError('Phone is required');
  }

  if (values.email !== null && !EMAIL_PATTERN.test(values.email)) {
    throw new BusinessDataValidationError('Email is invalid');
  }

  if (values.taxId !== null && !TAX_ID_PATTERN.test(values.taxId)) {
    throw new BusinessDataValidationError('Tax ID must have 11 or 14 digits');
  }
}
