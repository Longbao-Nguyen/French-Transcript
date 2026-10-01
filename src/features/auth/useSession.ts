import { useEffect, useState } from 'react';

import type { AppSession } from '../../types';

interface SessionState {
  session: AppSession | null;
  loading: boolean;
  error: string | null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load your sign-in session.');
        const payload = await response.json() as Partial<AppSession> | null;
        setState({
          session: payload?.user?.email ? payload as AppSession : null,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ session: null, loading: false, error: error instanceof Error ? error.message : 'Session failed.' });
      });
    return () => controller.abort();
  }, []);

  return state;
}
