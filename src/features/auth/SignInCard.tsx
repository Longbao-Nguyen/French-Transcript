import { useState } from 'react';
import { Headphones, LogIn } from 'lucide-react';

import { signInWithGoogle } from './authActions';

export function SignInCard({ error }: { error: string | null }) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const handleSignIn = async () => {
    setWorking(true);
    setActionError(null);
    try {
      await signInWithGoogle();
    } catch (authError) {
      setWorking(false);
      setActionError(authError instanceof Error ? authError.message : 'Could not start Google sign-in.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6fa] grid place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center">
          <Headphones className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">French Transcript</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Sign in to keep uploads and transcription jobs available across refreshes and devices.
        </p>
        {(error || actionError) && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError || error}</p>
        )}
        <button
          type="button"
          onClick={handleSignIn}
          disabled={working}
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="h-4 w-4" />
          {working ? 'Connecting…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
