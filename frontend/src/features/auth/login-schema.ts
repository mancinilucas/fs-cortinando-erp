import { z } from 'zod'
import type { Resolver } from 'react-hook-form'
import type { LoginCredentials } from './types'

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

export const loginResolver: Resolver<LoginCredentials> = (values) => {
  const result = loginSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: { email?: { type: string; message: string }; password?: { type: string; message: string } } = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if ((field === 'email' || field === 'password') && !errors[field]) errors[field] = { type: 'validate', message: issue.message }
  }
  return { values: {}, errors }
}
