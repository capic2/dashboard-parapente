import { useMutation } from '@tanstack/react-query';
import { isHTTPError } from 'ky';
import { z } from 'zod';
import { api } from '../../lib/api';

const LoginPayloadSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const LoginResponseSchema = z.object({
  access_token: z.string().min(1),
});

export type LoginPayload = {
  email: string;
  password: string;
};

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message) as Error & { cause?: unknown };
  error.cause = cause;
  return error;
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: LoginPayload) => {
      try {
        const payload = LoginPayloadSchema.parse({ email, password });
        const body = new URLSearchParams();
        body.append('username', payload.email);
        body.append('password', payload.password);

        const raw = await api
          .post('auth/login', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          })
          .json<unknown>();

        const data = LoginResponseSchema.parse(raw);

        return data.access_token;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('login.')) {
          throw error;
        }

        if (error instanceof z.ZodError) {
          throw withCause('login.unexpectedError', error);
        }

        if (isHTTPError(error) && error.response.status === 401) {
          throw withCause('login.invalidCredentials', error);
        }

        throw withCause('login.connectionError', error);
      }
    },
  });
}
