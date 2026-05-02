import { useForm } from '@tanstack/react-form';
import { tv } from 'tailwind-variants';
import { useTranslation } from 'react-i18next';
import { TextField, Label, Input, Form } from 'react-aria-components';
import { Button } from '@dashboard-parapente/design-system';

type LoginFormProps = {
  onSubmit: (value: { email: string; password: string }) => Promise<void>;
  isPending: boolean;
  errorMessage?: string;
};

type LoginFieldViewProps = {
  id: 'email' | 'password';
  type: 'email' | 'password';
  autoComplete: 'username' | 'current-password';
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  labelClassName: string;
};

const styles = tv({
  slots: {
    page: 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4',
    container: 'w-full max-w-sm',
    card: 'bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8',
    title:
      'text-2xl font-semibold text-center text-sky-600 dark:text-sky-400 mb-6',
    form: 'space-y-4',
    label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
    input:
      'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none',
    error: 'text-sm text-red-500 dark:text-red-400',
    submitButton:
      'w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-medium rounded-lg transition-colors pressed:bg-sky-800',
  },
});

function LoginFieldView({
  id,
  type,
  autoComplete,
  label,
  value,
  onChange,
  inputClassName,
  labelClassName,
}: LoginFieldViewProps) {
  return (
    <TextField isRequired value={value} onChange={onChange}>
      <Label className={labelClassName}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        className={inputClassName}
      />
    </TextField>
  );
}

export function LoginForm({
  onSubmit,
  isPending,
  errorMessage,
}: LoginFormProps) {
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
                  type="email"
                  autoComplete="username"
                  label={t('login.email')}
                  value={String(field.state.value ?? '')}
                  onChange={(value) => field.handleChange(value)}
                  inputClassName={s.input()}
                  labelClassName={s.label()}
                />
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <LoginFieldView
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  label={t('login.password')}
                  value={String(field.state.value ?? '')}
                  onChange={(value) => field.handleChange(value)}
                  inputClassName={s.input()}
                  labelClassName={s.label()}
                />
              )}
            </form.Field>

            {errorMessage ? (
              <p className={s.error()} role="alert" aria-live="polite">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              isDisabled={isPending}
              className={s.submitButton()}
            >
              {isPending ? t('login.loading') : t('login.submit')}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
