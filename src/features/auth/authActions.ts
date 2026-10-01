async function submitAuthAction(path: string): Promise<void> {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!csrfResponse.ok) throw new Error('Authentication is not configured yet.');
  const { csrfToken } = await csrfResponse.json() as { csrfToken?: string };
  if (!csrfToken) throw new Error('Could not start a secure authentication request.');

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = path;
  form.hidden = true;
  for (const [name, value] of Object.entries({ csrfToken, callbackUrl: window.location.origin })) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function signInWithGoogle(): Promise<void> {
  return submitAuthAction('/api/auth/signin/google');
}

export function signOut(): Promise<void> {
  return submitAuthAction('/api/auth/signout');
}
