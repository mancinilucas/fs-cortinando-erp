import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { GetCustomerContactQuery } from '../clientes/application/get-customer-contact.query.js';
import { GetBusinessDataQuery } from '../dados-do-negocio/application/get-business-data.query.js';
import { DadosDoNegocioModule } from '../dados-do-negocio/dados-do-negocio.module.js';
import { OrcamentosModule } from './orcamentos.module.js';

// Proves the Application-to-Application wiring (D153/D154/D155): Quotes
// imports the Dados do Negocio and Clientes modules and can resolve their
// exported queries. The module graph is compiled without initializing
// connections, so the test stays unit-level.
describe('OrcamentosModule document dependencies wiring', () => {
  it('resolves GetBusinessDataQuery exported by DadosDoNegocioModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DadosDoNegocioModule, OrcamentosModule],
    }).compile();

    expect(moduleRef.get(GetBusinessDataQuery)).toBeDefined();

    await moduleRef.close();
  });

  it('resolves GetCustomerContactQuery exported by ClientesModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OrcamentosModule],
    }).compile();

    // The query is provided via useClass against an abstract token
    // (implements, not extends), so resolving it is what proves the wiring.
    expect(moduleRef.get(GetCustomerContactQuery)).toBeDefined();

    await moduleRef.close();
  });
});
