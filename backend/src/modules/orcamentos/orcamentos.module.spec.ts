import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { GetBusinessDataQuery } from '../dados-do-negocio/application/get-business-data.query.js';
import { DadosDoNegocioModule } from '../dados-do-negocio/dados-do-negocio.module.js';
import { OrcamentosModule } from './orcamentos.module.js';

// Proves the Application-to-Application wiring (D153/D154): Quotes imports the
// Dados do Negocio module and can resolve the exported query. The module graph
// is compiled without initializing connections, so the test stays unit-level.
describe('OrcamentosModule business data wiring', () => {
  it('resolves GetBusinessDataQuery exported by DadosDoNegocioModule', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DadosDoNegocioModule, OrcamentosModule],
    }).compile();

    expect(moduleRef.get(GetBusinessDataQuery)).toBeInstanceOf(
      GetBusinessDataQuery,
    );

    await moduleRef.close();
  });
});
