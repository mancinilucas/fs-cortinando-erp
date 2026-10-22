# Frontend — Cortinando ERP

O frontend é uma SPA React + TypeScript, organizada por feature. Para executar
localmente, instale as dependências e inicie o Vite:

```bash
pnpm install
pnpm dev
```

O servidor de desenvolvimento fica em `http://localhost:5173` e encaminha as
rotas da API para `http://localhost:3000`. Use `localhost` de forma consistente
nos dois serviços, pois a sessão depende do cookie e da validação de origem.

`VITE_API_BASE_URL` é opcional e vazia por padrão; sem ela, as chamadas usam
paths relativos. Variáveis `VITE_*` são públicas: não coloque credenciais ou
segredos nelas. A topologia de produção será definida na Fase 12.

## Verificação

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
