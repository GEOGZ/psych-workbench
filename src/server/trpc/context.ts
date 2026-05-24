import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/options';
import { db } from '@/db';

export type UserRole = 'owner' | 'admin' | 'contractor';

export interface SessionUser {
  id: string;
  role: UserRole;
}

export interface Context {
  db: typeof db;
  user: SessionUser | null;
}

export async function createContext(): Promise<Context> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;
  return {
    db,
    user: sessionUser ?? null
  };
}
