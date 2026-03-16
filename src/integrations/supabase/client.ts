import type { Database } from './types';
import {
  type User as FirebaseUser,
  GoogleAuthProvider,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { firebaseAuth, getFirebaseFunctionsBaseUrl } from '@/integrations/firebase/client';
import { listTenantMembershipsByUser } from '@/lib/firebaseTenantCrud';

export interface AuthUserCompat {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  created_at?: string;
}

export interface AuthSessionCompat {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  token_type: 'bearer';
  user: AuthUserCompat;
}

type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'PASSWORD_RECOVERY';

type AuthStateCallback = (event: AuthChangeEvent, session: AuthSessionCompat | null) => void;

interface AuthResponse<T> {
  data: T;
  error: Error | null;
}

interface FunctionInvokeOptions {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}

interface RpcResponse<T> {
  data: T;
  error: Error | null;
}

interface SignInWithOAuthParams {
  provider: 'google';
  options?: {
    redirectTo?: string;
  };
}

interface SignUpParams {
  email: string;
  password: string;
  options?: {
    emailRedirectTo?: string;
    data?: {
      name?: string;
    };
  };
}

interface UpdateUserParams {
  password?: string;
  data?: {
    name?: string;
  };
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function removedLegacyDataAccess(): never {
  throw new Error('Legacy db/table access was removed. Use Firebase helpers from firebaseTenantCrud.');
}

function getRecoveryCodeFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  if (mode === 'resetPassword' && oobCode) {
    return oobCode;
  }

  return null;
}

function mapFirebaseUser(user: FirebaseUser): AuthUserCompat {
  return {
    id: user.uid,
    email: user.email,
    user_metadata: {
      name: user.displayName ?? undefined,
      picture: user.photoURL ?? undefined,
    },
    app_metadata: {},
    created_at: user.metadata.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : undefined,
  };
}

async function mapFirebaseSession(user: FirebaseUser | null): Promise<AuthSessionCompat | null> {
  if (!user) {
    return null;
  }

  const tokenResult = await user.getIdTokenResult();

  return {
    access_token: tokenResult.token,
    refresh_token: user.refreshToken ?? '',
    expires_at: tokenResult.expirationTime ? Math.floor(new Date(tokenResult.expirationTime).getTime() / 1000) : null,
    token_type: 'bearer',
    user: mapFirebaseUser(user),
  };
}

export const authClient = {
  async getSession(): Promise<AuthResponse<{ session: AuthSessionCompat | null }>> {
    try {
      const currentUser = firebaseAuth.currentUser;
      if (currentUser) {
        const session = await mapFirebaseSession(currentUser);
        return { data: { session }, error: null };
      }

      const recoveryCode = getRecoveryCodeFromUrl();
      if (recoveryCode) {
        return {
          data: {
            session: {
              access_token: 'password-recovery',
              refresh_token: '',
              expires_at: null,
              token_type: 'bearer',
              user: {
                id: 'password-recovery',
                email: null,
                user_metadata: {},
                app_metadata: {},
              },
            },
          },
          error: null,
        };
      }

      return { data: { session: null }, error: null };
    } catch (error) {
      return { data: { session: null }, error: toError(error) };
    }
  },

  async getUser(): Promise<AuthResponse<{ user: AuthUserCompat | null }>> {
    try {
      const user = firebaseAuth.currentUser ? mapFirebaseUser(firebaseAuth.currentUser) : null;
      return { data: { user }, error: null };
    } catch (error) {
      return { data: { user: null }, error: toError(error) };
    }
  },

  onAuthStateChange(callback: AuthStateCallback): { data: { subscription: { unsubscribe: () => void } } } {
    const recoveryCode = getRecoveryCodeFromUrl();
    if (recoveryCode && !firebaseAuth.currentUser) {
      callback('PASSWORD_RECOVERY', {
        access_token: 'password-recovery',
        refresh_token: '',
        expires_at: null,
        token_type: 'bearer',
        user: {
          id: 'password-recovery',
          email: null,
          user_metadata: {},
          app_metadata: {},
        },
      });
    }

    let isFirstEvent = true;
    let lastUid = firebaseAuth.currentUser?.uid ?? null;

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (fbUser) => {
      try {
        const session = await mapFirebaseSession(fbUser);
        let event: AuthChangeEvent = 'TOKEN_REFRESHED';

        if (isFirstEvent) {
          event = 'INITIAL_SESSION';
          isFirstEvent = false;
        } else if (!fbUser && lastUid) {
          event = 'SIGNED_OUT';
        } else if (fbUser && !lastUid) {
          event = 'SIGNED_IN';
        } else if (fbUser && lastUid && fbUser.uid === lastUid) {
          event = 'TOKEN_REFRESHED';
        } else if (fbUser && lastUid && fbUser.uid !== lastUid) {
          event = 'SIGNED_IN';
        }

        lastUid = fbUser?.uid ?? null;
        callback(event, session);
      } catch {
        callback('SIGNED_OUT', null);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe,
        },
      },
    };
  },

  async signInWithPassword(params: { email: string; password: string }): Promise<AuthResponse<{ user: AuthUserCompat | null; session: AuthSessionCompat | null }>> {
    try {
      const credentials = await signInWithEmailAndPassword(firebaseAuth, params.email, params.password);
      const session = await mapFirebaseSession(credentials.user);
      return { data: { user: mapFirebaseUser(credentials.user), session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: toError(error) };
    }
  },

  async signUp(params: SignUpParams): Promise<AuthResponse<{ user: AuthUserCompat | null; session: AuthSessionCompat | null }>> {
    try {
      const credentials = await createUserWithEmailAndPassword(firebaseAuth, params.email, params.password);

      if (params.options?.data?.name) {
        await updateProfile(credentials.user, { displayName: params.options.data.name });
      }

      if (params.options?.emailRedirectTo) {
        await sendEmailVerification(credentials.user, { url: params.options.emailRedirectTo });
      }

      const session = await mapFirebaseSession(credentials.user);
      return { data: { user: mapFirebaseUser(credentials.user), session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: toError(error) };
    }
  },

  async signInWithOAuth(params: SignInWithOAuthParams): Promise<AuthResponse<{ provider: string }>> {
    try {
      if (params.provider !== 'google') {
        return { data: { provider: params.provider }, error: new Error('Provider nao suportado') };
      }

      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);

      return { data: { provider: params.provider }, error: null };
    } catch (error) {
      return { data: { provider: params.provider }, error: toError(error) };
    }
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<AuthResponse<Record<string, never>>> {
    try {
      await sendPasswordResetEmail(firebaseAuth, email, {
        url: options?.redirectTo,
        handleCodeInApp: true,
      });
      return { data: {}, error: null };
    } catch (error) {
      return { data: {}, error: toError(error) };
    }
  },

  async updateUser(params: UpdateUserParams): Promise<AuthResponse<{ user: AuthUserCompat | null }>> {
    try {
      const currentUser = firebaseAuth.currentUser;

      if (params.password) {
        if (currentUser) {
          await updatePassword(currentUser, params.password);
        } else {
          const recoveryCode = getRecoveryCodeFromUrl();
          if (!recoveryCode) {
            return { data: { user: null }, error: new Error('Sessao invalida para redefinir senha') };
          }
          await confirmPasswordReset(firebaseAuth, recoveryCode, params.password);
        }
      }

      if (params.data?.name && currentUser) {
        await updateProfile(currentUser, { displayName: params.data.name });
      }

      const refreshedUser = firebaseAuth.currentUser ? mapFirebaseUser(firebaseAuth.currentUser) : null;
      return { data: { user: refreshedUser }, error: null };
    } catch (error) {
      return { data: { user: null }, error: toError(error) };
    }
  },

  async refreshSession(): Promise<AuthResponse<{ session: AuthSessionCompat | null }>> {
    try {
      if (!firebaseAuth.currentUser) {
        return { data: { session: null }, error: null };
      }

      await firebaseAuth.currentUser.getIdToken(true);
      const session = await mapFirebaseSession(firebaseAuth.currentUser);
      return { data: { session }, error: null };
    } catch (error) {
      return { data: { session: null }, error: toError(error) };
    }
  },

  async signOut(): Promise<AuthResponse<Record<string, never>>> {
    try {
      await firebaseSignOut(firebaseAuth);
      return { data: {}, error: null };
    } catch (error) {
      return { data: {}, error: toError(error) };
    }
  },
};

export const functionsClient = {
  async invoke(functionName: string, options?: FunctionInvokeOptions): Promise<AuthResponse<unknown>> {
    const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    };

    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const parseResponse = async (response: Response) => {
      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return text;
      }
    };

    const firebaseFunctionName = functionName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

    const call = async (url: string) => {
      const response = await fetch(url, {
        method: options?.method ?? 'POST',
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      const parsed = await parseResponse(response);
      return { response, parsed };
    };

    try {
      const firebaseUrl = `${getFirebaseFunctionsBaseUrl()}/${firebaseFunctionName}`;
      const primary = await call(firebaseUrl);

      if (primary.response.ok) {
        return { data: primary.parsed, error: null };
      }

      const primaryMessage =
        (primary.parsed &&
        typeof primary.parsed === 'object' &&
        'error' in primary.parsed &&
        typeof (primary.parsed as { error?: unknown }).error === 'string')
          ? (primary.parsed as { error: string }).error
          : `HTTP ${primary.response.status}`;
      return { data: primary.parsed, error: new Error(primaryMessage) };
    } catch (error) {
      return { data: null, error: toError(error) };
    }
  },
};

export const rpcClient = async <T = unknown>(fn: string, params?: Record<string, unknown>): Promise<RpcResponse<T>> => {
  try {
    if (fn === 'get_user_tenant_id') {
      const uid = firebaseAuth.currentUser?.uid;
      if (!uid) {
        return { data: null as T, error: null };
      }
      const memberships = await listTenantMembershipsByUser(uid);
      return { data: ((memberships[0]?.tenant_id ?? null) as T), error: null };
    }

    return {
      data: null as T,
      error: new Error(`Legacy rpc '${fn}' is no longer available. Migrate this call to Firebase helpers/functions.`),
    };
  } catch (error) {
    return { data: null as T, error: toError(error) };
  }
};

type LegacyDataAccessMethod = (collectionName: keyof Database['public']['Tables'] | string) => never;

export type SupabaseCompatClient = {
  auth: typeof authClient;
  functions: typeof functionsClient;
  rpc: typeof rpcClient;
  db: LegacyDataAccessMethod;
  table: LegacyDataAccessMethod;
};

export const supabase: SupabaseCompatClient = {
  auth: authClient,
  functions: functionsClient,
  rpc: rpcClient,
  db: removedLegacyDataAccess,
  table: removedLegacyDataAccess,
};

export type BackendCompatClient = SupabaseCompatClient;

export const backendAuthClient = authClient;
export const backendFunctionsClient = functionsClient;
export const backendRpcClient = rpcClient;
export const backendClient = supabase;



