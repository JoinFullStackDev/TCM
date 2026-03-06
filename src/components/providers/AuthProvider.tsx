'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/types/database';
import { hasPermission, hasMinRole, type Permission } from '@/lib/auth/rbac';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
  isAtLeast: (minRole: UserRole) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: 'viewer',
  isLoading: true,
  can: () => false,
  isAtLeast: () => false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data as Profile);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        setUser(currentUser);
        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } catch {
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await fetchProfile(sessionUser.id);
        } else {
          setProfile(null);
        }
      } catch {
        setUser(null);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const role: UserRole = profile?.role ?? 'viewer';

  const can = useCallback(
    (permission: Permission) => hasPermission(role, permission),
    [role],
  );

  const isAtLeast = useCallback(
    (minRole: UserRole) => hasMinRole(role, minRole),
    [role],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const value = useMemo(
    () => ({ user, profile, role, isLoading, can, isAtLeast, signOut }),
    [user, profile, role, isLoading, can, isAtLeast, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
