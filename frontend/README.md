# Execução local

Dentro de `frontend/`, use `pnpm install` e `pnpm dev`. A SPA usa
`http://localhost:5173`; a API local deve estar em `http://localhost:3000`.
Não misture `localhost` e `127.0.0.1`, pois cookie e CSRF dependem da origem.
O frontend e o backend têm instalações pnpm e lockfiles independentes.

`.env.example` documenta `VITE_API_BASE_URL`, opcional e vazia por padrão.
Sem valor, o cliente futuro usará paths relativos. O proxy preserva `Origin`
e encaminha `/auth`, `/clientes`, `/orcamentos`, `/dashboard` e
`/dados-do-negocio` para a API. Navegações HTML nesses caminhos recebem a SPA.
Variáveis `VITE_*` são públicas: nunca inclua credenciais ou segredos.
A topologia de produção será definida na Fase 12.

Nesta fundação, as rotas de produto ficam fechadas por um placeholder que
não renderiza o Outlet; o bootstrap real da sessão e o guard entram nas tasks
11–13. `/login` e a rota de não encontrado têm apenas títulos provisórios.
Não há login, sessão simulada ou funcionalidade de produto nesta etapa.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
