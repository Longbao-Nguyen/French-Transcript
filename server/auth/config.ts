import { Auth, type AuthConfig } from '@auth/core';
import Google, { type GoogleProfile } from '@auth/core/providers/google';

import { getRepositories } from '../db/index.js';

function required(name: 'AUTH_SECRET' | 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function getAuthConfig(): AuthConfig {
  return {
    basePath: '/api/auth',
    secret: required('AUTH_SECRET'),
    trustHost: true,
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },
    providers: [
      Google({
        clientId: required('GOOGLE_CLIENT_ID'),
        clientSecret: required('GOOGLE_CLIENT_SECRET'),
      }),
    ],
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider !== 'google') return false;
        return Boolean((profile as GoogleProfile | undefined)?.email_verified);
      },
      async jwt({ token, user, profile }) {
        if (user?.email) {
          const googleProfile = profile as GoogleProfile | undefined;
          const repositories = await getRepositories();
          const appUser = await repositories.users.upsertGoogleUser({
            email: user.email,
            googleSubject: googleProfile?.sub || user.id,
            displayName: user.name,
            imageUrl: user.image,
          });
          token.appUserId = appUser.id;
        }
        return token;
      },
    },
  };
}

export function handleAuthRequest(request: Request): Promise<Response> {
  return Auth(request, getAuthConfig());
}
