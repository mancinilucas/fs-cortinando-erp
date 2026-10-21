export type AuthUser = { readonly id: string; readonly email: string }
export type LoginCredentials = { readonly email: string; readonly password: string }

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'authenticated'; readonly user: AuthUser }
  | { readonly status: 'anonymous' }
  | { readonly status: 'error'; readonly message: string }
