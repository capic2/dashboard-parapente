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

type LoginFormViewProps = {
  form: ReturnType<typeof useForm<{ email: string; password: string }>>;
  isPending: boolean;
  errorMessage?: string;
  emailLabel: string;
  passwordLabel: string;
  title: string;
  loadingLabel: string;
  submitLabel: string;
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

type LoginFieldProps = {
  form: ReturnType<typeof useForm<{ email: string; password: string }>>;
  label: string;
  name: 'email' | 'password';
  type: 'email' | 'password';
  autoComplete: 'username' | 'current-password';
  inputClassName: string;
  labelClassName: string;
};

function LoginField({
  form,
  label,
  name,
  type,
  autoComplete,
  inputClassName,
  labelClassName,
}: LoginFieldProps) {
  return (
    <form.Field name={name}>
      {(field) => (
        <TextField
          isRequired
          value={field.state.value}
          onChange={field.handleChange}
        >
          <Label className={labelClassName}>{label}</Label>
          <Input
            id={name}
            type={type}
            autoComplete={autoComplete}
            className={inputClassName}
          />
        </TextField>
      )}
    </form.Field>
  );
}

function LoginFormView({
  form,
  isPending,
  errorMessage,
  emailLabel,
  passwordLabel,
  title,
  loadingLabel,
  submitLabel,
}: LoginFormViewProps) {
  const s = styles();

  return (
    <div className={s.page()}>
      <div className={s.container()}>
        <div className={s.card()}>
          <h1 className={s.title()}>{title}</h1>

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className={s.form()}
          >
            <LoginField
              form={form}
              label={emailLabel}
              name="email"
              type="email"
              autoComplete="username"
              inputClassName={s.input()}
              labelClassName={s.label()}
            />

            <LoginField
              form={form}
              label={passwordLabel}
              name="password"
              type="password"
              autoComplete="current-password"
              inputClassName={s.input()}
              labelClassName={s.label()}
            />

            {errorMessage ? <p className={s.error()}>{errorMessage}</p> : null}

            <Button
              type="submit"
              isDisabled={isPending}
              className={s.submitButton()}
            >
              {isPending ? loadingLabel : submitLabel}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

export function LoginForm({
  onSubmit,
  isPending,
  errorMessage,
}: LoginFormProps) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  return (
    <LoginFormView
      form={form}
      isPending={isPending}
      errorMessage={errorMessage}
      emailLabel={t('login.email')}
      passwordLabel={t('login.password')}
      title={t('login.title')}
      loadingLabel={t('login.loading')}
      submitLabel={t('login.submit')}
    />
  );
}
