import { useMutation } from '@tanstack/react-query';
import { isHTTPError } from 'ky';
import { api } from '../../lib/api';

type LoginResponse = {
  access_token?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export function useLogin() {
  return useMutation({
    mutationFn: async ({ email, password }: LoginPayload) => {
      try {
        const body = new URLSearchParams();
        body.append('username', email);
        body.append('password', password);

        const data = await api
          .post('auth/login', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
          })
          .json<LoginResponse>();

        if (!data.access_token) {
          throw new Error('login.unexpectedError');
        }

        return data.access_token;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('login.')) {
          throw error;
        }

        if (isHTTPError(error) && error.response.status === 401) {
          throw new Error('login.invalidCredentials', { cause: error });
        }

        throw new Error('login.connectionError', { cause: error });
      }
    },
  });
}
