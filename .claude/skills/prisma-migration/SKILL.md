---
name: prisma-migration
description: Cria, aplica e valida uma migration Prisma 7 no ambiente local, com revisão do SQL gerado. Use somente quando uma task autorizar mudança de schema.
argument-hint: <nome-da-migration>
disable-model-invocation: true
---

# prisma-migration

Skill com efeito colateral no banco local. Execute apenas quando uma task de `docs/development/` autorizar mudança de schema.

## Pré-condições

1. Leia a task e a development spec ativa.
2. Confirme que a alteração de `backend/prisma/schema.prisma` está dentro do escopo.
3. Confirme que o PostgreSQL está no ar:

   ```bash
   docker compose ps
   ```

4. Revise o diff do schema:

   ```bash
   git diff backend/prisma/schema.prisma
   ```

5. Valide o schema:

   ```bash
   cd backend
   npx prisma validate
   ```

Se o banco não estiver saudável ou o schema não validar, pare e reporte.

## Criar a migration

```bash
cd backend
npx prisma format
npx prisma migrate dev --name <nome-da-migration>
```

- Use nome curto e descritivo em snake_case (ex.: `init_schema`).
- Não use `migrate reset` sem confirmação explícita do usuário.
- Não edite migrations já aplicadas.
- Nunca altere `backend/.env` para apontar para outro banco.

## Revisar o SQL gerado

Leia `backend/prisma/migrations/<timestamp>_<nome>/migration.sql` e verifique:

- cascades inesperados (especialmente em histórico);
- `ON DELETE RESTRICT` nas FKs de agregados;
- tipos e precisão corretos (`Decimal(p,s)`, `Int` para centavos);
- nulabilidade coerente com rascunhos incompletos;
- índices e unicidades previstos;
- operações destrutivas não planejadas (`DROP`, `TRUNCATE`, recriação de tabela).

Divergências devem ser corrigidas na fonte (`schema.prisma` ou decisão arquitetural), nunca editando o SQL manualmente.

## Validar

```bash
cd backend
npx prisma migrate status
npx prisma generate
npx prisma validate
```

Validação em banco vazio, quando viável e autorizada: use uma `DATABASE_URL` temporária apenas no ambiente do comando (sem editar `backend/.env`), aplique as migrations e remova o banco ao final. Confirme os nomes de serviço e credenciais no `docker-compose.yml` antes.

## Encerrar

Reporte:

- nome e caminho da migration;
- resumo do SQL (tabelas, constraints, índices, FKs);
- comandos executados e resultados;
- riscos ou divergências encontradas.

Atualize a development spec se ela exigir registro da migration.
