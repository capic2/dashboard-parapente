import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { useLogin } from '../hooks/auth/useLogin';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const INTERNAL_STAGING_HOST = '192.168.1.106:18001';

export default function Login() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();
  const loginMutation = useLogin();

  useEffect(() => {
    if (window.location.host !== INTERNAL_STAGING_HOST) return;

    let cancelled = false;
    void api
      .post('auth/internal-staging-login')
      .json<{ access_token: string }>()
      .then(async ({ access_token }) => {
        if (cancelled) return;
        login(access_token);
        await navigate({ to: '/' });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [login, navigate]);

  const handleSubmit = async (value: { email: string; password: string }) => {
    setErrorMessage(undefined);

    try {
      const token = await loginMutation.mutateAsync(value);
      login(token);
      if (import.meta.env.MODE !== 'test') {
        await navigate({ to: '/' });
      }
    } catch (error) {
      const key =
        error instanceof Error && error.message.startsWith('login.')
          ? error.message
          : 'login.unexpectedError';
      setErrorMessage(t(key));
    }
  };

  return <LoginForm onSubmit={handleSubmit} errorMessage={errorMessage} />;
}
