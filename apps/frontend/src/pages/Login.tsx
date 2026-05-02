import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { useLogin } from '../hooks/auth/useLogin';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();
  const loginMutation = useLogin();

  const handleSubmit = async (value: { email: string; password: string }) => {
    setErrorMessage(undefined);

    try {
      const token = await loginMutation.mutateAsync(value);
      login(token);
      await navigate({ to: '/' });
    } catch (error) {
      const key =
        error instanceof Error && error.message.startsWith('login.')
          ? error.message
          : 'login.unexpectedError';
      setErrorMessage(t(key));
    }
  };

  return (
    <LoginForm
      onSubmit={handleSubmit}
      isPending={loginMutation.isPending}
      errorMessage={errorMessage}
    />
  );
}
