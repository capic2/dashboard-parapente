import { delay, http, HttpResponse } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import preview from '../../.storybook/preview';
import Login from './Login';
import { useAuthStore } from '../stores/authStore';

const meta = preview.meta({
  title: 'Pages/Login',
  component: Login,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

const successHandler = http.post('*/api/auth/login', async () => {
  await delay(200);
  return HttpResponse.json({ access_token: 'storybook-jwt-token' });
});

export const Default = meta.story({
  name: 'Default',
  beforeEach: () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });
    localStorage.removeItem('parapente-auth');
  },
  parameters: {
    msw: {
      handlers: [successHandler],
    },
  },
});

Default.test('renders login form', async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByLabelText(/email/i);
  await canvas.findByLabelText(/mot de passe|password/i);
  await canvas.findByRole('button', { name: /se connecter|sign in/i });
});

export const Loading = meta.story({
  name: 'Loading',
  beforeEach: () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });
    localStorage.removeItem('parapente-auth');
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/auth/login', async () => {
          await new Promise(() => {});
        }),
      ],
    },
  },
});

Loading.test('shows pending state after submit', async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await userEvent.type(await canvas.findByLabelText(/email/i), 'test@test.dev');
  await userEvent.type(
    await canvas.findByLabelText(/mot de passe|password/i),
    'secret123'
  );
  await userEvent.click(
    await canvas.findByRole('button', { name: /se connecter|sign in/i })
  );

  await canvas.findByRole('button', { name: /connexion|signing in/i });
});

export const InvalidCredentials = meta.story({
  name: 'Invalid Credentials',
  beforeEach: () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });
    localStorage.removeItem('parapente-auth');
  },
  parameters: {
    msw: {
      handlers: [
        http.post('*/api/auth/login', () => {
          return new HttpResponse(null, { status: 401 });
        }),
      ],
    },
  },
});

InvalidCredentials.test(
  'shows API error message',
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      await canvas.findByLabelText(/email/i),
      'wrong@test.dev'
    );
    await userEvent.type(
      await canvas.findByLabelText(/mot de passe|password/i),
      'wrong-pass'
    );
    await userEvent.click(
      await canvas.findByRole('button', { name: /se connecter|sign in/i })
    );

    await canvas.findByText(/incorrect|invalid/i);
  }
);

export const SubmitSuccess = meta.story({
  name: 'Submit Success',
  beforeEach: () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });
    localStorage.removeItem('parapente-auth');
  },
  parameters: {
    msw: {
      handlers: [successHandler],
    },
  },
});

SubmitSuccess.test('logs user in after submit', async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await userEvent.type(
    await canvas.findByLabelText(/email/i),
    'pilot@test.dev'
  );
  await userEvent.type(
    await canvas.findByLabelText(/mot de passe|password/i),
    'very-secret'
  );
  await userEvent.click(
    await canvas.findByRole('button', { name: /se connecter|sign in/i })
  );

  await expect(useAuthStore.getState().token).toBe('storybook-jwt-token');
  await expect(useAuthStore.getState().isAuthenticated).toBe(true);
});
