import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { PrismaSearchCustomersQuery } from './prisma-search-customers.query.js';

describe('PrismaSearchCustomersQuery', () => {
  const token = randomUUID();

  let prisma: PrismaService;
  let query: PrismaSearchCustomersQuery;
  let createdIds: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    query = new PrismaSearchCustomersQuery(prisma);
  });

  beforeEach(() => {
    createdIds = [];
  });

  afterEach(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function withToken(name: string): string {
    return `${name} ${token}`;
  }

  async function createCustomer(
    name: string,
    options: { deleted?: boolean } = {},
  ): Promise<string> {
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: '11999999999',
        email: `${randomUUID()}@example.com`,
        deletedAt: options.deleted ? new Date() : null,
      },
      select: { id: true },
    });

    createdIds.push(customer.id);

    return customer.id;
  }

  it('lists only active customers ordered by name without a search term', async () => {
    await createCustomer(withToken('Zulu'));
    await createCustomer(withToken('Alpha'));
    await createCustomer(withToken('Mike'));
    const deletedId = await createCustomer(withToken('Deleted'), {
      deleted: true,
    });

    const results = await query.execute();

    const ours = results.filter((summary) => summary.name.endsWith(token));

    expect(ours.map((summary) => summary.name)).toEqual([
      withToken('Alpha'),
      withToken('Mike'),
      withToken('Zulu'),
    ]);
    expect(results.some((summary) => summary.id === deletedId)).toBe(false);
    expect(Object.keys(ours[0]).sort()).toEqual([
      'email',
      'id',
      'name',
      'phone',
    ]);
  });

  it('treats an empty or blank search as the full listing', async () => {
    await createCustomer(withToken('Alpha'));

    const results = await query.execute('   ');

    expect(
      results
        .filter((summary) => summary.name.endsWith(token))
        .map((summary) => summary.name),
    ).toEqual([withToken('Alpha')]);
  });

  it('matches a partial name', async () => {
    const maria = await createCustomer(withToken('Maria'));
    const mariana = await createCustomer(withToken('Mariana'));
    const unrelated = await createCustomer(`Joana ${randomUUID()}`);

    const results = await query.execute(token.slice(0, 8));

    expect(results.map((summary) => summary.id)).toEqual([maria, mariana]);
    expect(results.some((summary) => summary.id === unrelated)).toBe(false);
  });

  it('matches case-insensitively', async () => {
    const id = await createCustomer(withToken('MiXeD'));

    const results = await query.execute(`mixed ${token}`);

    expect(results.map((summary) => summary.id)).toEqual([id]);
  });

  it('remains accent-sensitive', async () => {
    const jose = await createCustomer(`José ${token}`);

    await expect(query.execute(`Jose ${token}`)).resolves.toEqual([]);

    const results = await query.execute(`José ${token}`);

    expect(results.map((summary) => summary.id)).toEqual([jose]);
  });

  it('excludes soft-deleted customers from search results', async () => {
    const active = await createCustomer(withToken('Active'));
    await createCustomer(withToken('Deleted'), { deleted: true });

    const results = await query.execute(token);

    expect(results.map((summary) => summary.id)).toEqual([active]);
  });

  it('breaks name ties deterministically by id', async () => {
    const first = await createCustomer(withToken('Same'));
    const second = await createCustomer(withToken('Same'));

    const results = await query.execute(token);

    expect(results.map((summary) => summary.id)).toEqual(
      [first, second].sort(),
    );
  });
});
