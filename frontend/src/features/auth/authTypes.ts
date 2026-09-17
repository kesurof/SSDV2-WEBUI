export const AUTH_TYPES = ['aucune', 'basique', 'authelia', 'oauth', 'oauth2-proxy'] as const

export type AuthType = (typeof AUTH_TYPES)[number]
