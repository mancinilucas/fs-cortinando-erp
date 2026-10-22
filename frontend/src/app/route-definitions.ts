export const productRoutes = [
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/clientes', title: 'Clientes' },
  { path: '/clientes/novo', title: 'Novo cliente' },
  { path: '/clientes/:customerId', title: 'Cliente' },
  { path: '/clientes/:customerId/editar', title: 'Editar cliente' },
  { path: '/clientes/:customerId/orcamentos/novo', title: 'Novo orçamento' },
  { path: '/orcamentos', title: 'Orçamentos' },
  { path: '/orcamentos/:quoteId', title: 'Orçamento' },
  { path: '/orcamentos/:quoteId/editar', title: 'Editar orçamento' },
  { path: '/configuracoes/dados-do-negocio', title: 'Dados do negócio' },
] as const
