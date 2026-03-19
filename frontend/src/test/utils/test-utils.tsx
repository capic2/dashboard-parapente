import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })

interface TestProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

function TestProviders({ children, queryClient }: TestProvidersProps) {
  const client = queryClient || createTestQueryClient()
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  const { queryClient, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
export { customRender as render, createTestQueryClient }
