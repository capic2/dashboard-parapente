import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: { get },
}));

import { flightQueryOptions } from './useFlight';

describe('flight detail query', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('fetches a direct flight independently of loaded summary pages', async () => {
    const json = vi.fn().mockResolvedValue({
      id: 'old-flight',
      flight_date: '2020-01-01',
    });
    get.mockReturnValue({ json });

    const options = flightQueryOptions('old-flight');
    const flight = await options.queryFn?.({
      queryKey: options.queryKey,
      signal: new AbortController().signal,
      meta: undefined,
      client: undefined,
    } as never);

    expect(get).toHaveBeenCalledWith('flights/old-flight');
    expect(flight).toMatchObject({ id: 'old-flight' });
  });
});
