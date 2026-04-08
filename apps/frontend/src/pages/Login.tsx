import { useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import { TextField, Label, Input, Button, Form } from 'react-aria-components';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      const body = new URLSearchParams();
      body.append('username', value.email);
      body.append('password', value.password);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!res.ok) {
        throw new Error(t('login.invalidCredentials'));
      }

      const data = await res.json();
      if (!data.access_token) {
        throw new Error(t('login.unexpectedError'));
      }

      login(data.access_token);
      navigate({ to: '/' });
    },
  });

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none';
  const labelClass =
    'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-semibold text-center text-sky-600 mb-6">
            {t('login.title')}
          </h1>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="email">
              {(field) => (
                <TextField
                  isRequired
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label className={labelClass}>{t('login.email')}</Label>
                  <Input
                    type="email"
                    autoComplete="username"
                    className={inputClass}
                  />
                </TextField>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <TextField
                  isRequired
                  value={field.state.value}
                  onChange={field.handleChange}
                >
                  <Label className={labelClass}>{t('login.password')}</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </TextField>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
              {(errorMap) =>
                errorMap ? (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {String(errorMap)}
                  </p>
                ) : null
              }
            </form.Subscribe>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  isDisabled={isSubmitting}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-medium rounded-lg transition-colors pressed:bg-sky-800"
                >
                  {isSubmitting ? t('login.loading') : t('login.submit')}
                </Button>
              )}
            </form.Subscribe>
          </Form>
        </div>
      </div>
    </div>
  );
}
