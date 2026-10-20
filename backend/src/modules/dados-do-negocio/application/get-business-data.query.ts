import { Injectable } from '@nestjs/common';
import { BusinessDataNotFoundError } from './business-data-not-found.error.js';
import {
  BusinessDataRecord,
  BusinessDataStore,
} from './business-data-store.js';

@Injectable()
export class GetBusinessDataQuery {
  constructor(private readonly businessData: BusinessDataStore) {}

  async execute(): Promise<BusinessDataRecord> {
    const record = await this.businessData.find();

    if (record === null) {
      throw new BusinessDataNotFoundError();
    }

    return record;
  }
}
