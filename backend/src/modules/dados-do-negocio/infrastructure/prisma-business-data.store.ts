import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import {
  BusinessDataRecord,
  BusinessDataStore,
  BusinessDataValues,
} from '../application/business-data-store.js';

// The business configuration is a singleton (D127). The persistence identifier
// stays private to the infrastructure layer and is never exposed by the API.
const BUSINESS_DATA_ID = 'business';

const BUSINESS_DATA_SELECT = {
  commercialNameOrConsultant: true,
  phone: true,
  email: true,
  taxId: true,
  updatedAt: true,
} as const;

interface BusinessDataRow {
  commercialNameOrConsultant: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  updatedAt: Date;
}

@Injectable()
export class PrismaBusinessDataStore implements BusinessDataStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(): Promise<BusinessDataRecord | null> {
    const row = await this.prisma.businessData.findUnique({
      where: { id: BUSINESS_DATA_ID },
      select: BUSINESS_DATA_SELECT,
    });

    return row === null ? null : toRecord(row);
  }

  async upsert(values: BusinessDataValues): Promise<BusinessDataRecord> {
    const row = await this.prisma.businessData.upsert({
      where: { id: BUSINESS_DATA_ID },
      create: { id: BUSINESS_DATA_ID, ...values },
      update: values,
      select: BUSINESS_DATA_SELECT,
    });

    return toRecord(row);
  }
}

function toRecord(row: BusinessDataRow): BusinessDataRecord {
  return {
    commercialNameOrConsultant: row.commercialNameOrConsultant,
    phone: row.phone,
    email: row.email,
    taxId: row.taxId,
    updatedAt: row.updatedAt,
  };
}
