import { useForm } from '@tanstack/react-form';
import { tv } from 'tailwind-variants';
import { useTranslation } from 'react-i18next';
import { Form } from 'react-aria-components';
import { Button } from '@dashboard-parapente/core/Button/Button';
import { TextField } from '@dashboard-parapente/design-system/form';

type LoginFormProps = {
  onSubmit: (value: { email: string; password: string }) => Promise<void>;
  errorMessage?: string;
};

type LoginFieldViewProps = {
  id: 'email' | 'password';
  name: 'username' | 'password';
  type: 'email' | 'password';
  autoComplete: 'username' | 'current-password';
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const styles = tv({
  slots: {
    page: 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4',
    container: 'w-full max-w-sm',
    card: 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8',
    title:
      'text-2xl font-semibold text-center text-sky-600 dark:text-sky-400 mb-6',
    form: 'space-y-4',
    error: 'text-sm text-red-500 dark:text-red-400',
    submitButton:
      'w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-medium rounded-lg transition-colors pressed:bg-sky-800',
  },
});

function LoginFieldView({
  id,
  name,
  type,
  autoComplete,
  label,
  value,
  onChange,
}: LoginFieldViewProps) {
  return (
    <TextField
      id={id}
      name={name}
      isRequired
      label={label}
      type={type}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
    />
  );
}

export function LoginForm({ onSubmit, errorMessage }: LoginFormProps) {
  const { t } = useTranslation();
  const s = styles();

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <div className={s.page()}>
      <div className={s.container()}>
        <div className={s.card()}>
          <h1 className={s.title()}>{t('login.title')}</h1>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className={s.form()}
          >
            <form.Field name="email">
              {(field) => (
                <LoginFieldView
                  id="email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  label={t('login.email')}
                  value={String(field.state.value ?? '')}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <LoginFieldView
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  label={t('login.password')}
                  value={String(field.state.value ?? '')}
                  onChange={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>

            {errorMessage ? (
              <p className={s.error()} role="alert" aria-live="polite">
                {errorMessage}
              </p>
            ) : null}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type="submit"
                  isDisabled={isSubmitting}
                  className={s.submitButton()}
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
