export interface BusinessDataValues {
  commercialNameOrConsultant: string;
  phone: string;
  email: string | null;
  taxId: string | null;
}

export interface BusinessDataRecord extends BusinessDataValues {
  updatedAt: Date;
}

// Persistence boundary for the single business configuration (D127/D134).
// The identifier and Prisma mapping belong to the implementation.
export abstract class BusinessDataStore {
  abstract find(): Promise<BusinessDataRecord | null>;
  abstract upsert(values: BusinessDataValues): Promise<BusinessDataRecord>;
}
