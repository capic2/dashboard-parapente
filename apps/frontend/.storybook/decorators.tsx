import type { Decorator, StoryContext } from '@storybook/react-vite'
import type {
  AnyContext,
  LoaderFnContext,
  RootRoute,
  Route,
  RouteComponent,
} from '@tanstack/react-router'

import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  ErrorComponent,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

interface RouteConfig {
  path: string
  element: RouteComponent | 'story' //story is a special value that will render the story
  loader?: /* eslint-disable @typescript-eslint/no-explicit-any */
  | ((
        ctx: LoaderFnContext<
          RootRoute<undefined, object, AnyContext, AnyContext, object>,
          any,
          any,
          any,
          AnyContext,
          any,
          any
        >,
      ) => any)
    | undefined
  /* eslint-enable @typescript-eslint/no-explicit-any */
  children?: RouteConfig[]
  beforeLoad?: /* eslint-disable @typescript-eslint/no-explicit-any */
  | ((
        ctx: LoaderFnContext<
          RootRoute<undefined, object, AnyContext, AnyContext, object>,
          any,
          any,
          any,
          AnyContext,
          any,
          any
        >,
      ) => any)
    | undefined
  /* eslint-enable @typescript-eslint/no-explicit-any */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validateSearch?: (search: Record<string, unknown>) => any
  loaderDeps?: (deps: Record<string, unknown>) => Record<string, unknown>
}

interface TanstackRouterDecoratorContext extends StoryContext {
  parameters: {
    router?: {
      initialPath?: string
      renderRootRoute?: (Story: Parameters<Decorator>[0]) => React.ReactNode
      routes: RouteConfig[]
    }
    enableTanstackRouterDevTools?: boolean
  }
}

export const TanstackRouterDecorator: Decorator = (
  Story,
  context: TanstackRouterDecoratorContext,
) => {
  const {
    initialPath = '/',
    routes = [
      { path: '/', element: Story, loader: undefined, children: undefined },
    ],
  } = context.parameters.router ?? {}

  const rootRoute = createRootRouteWithContext<{
    queryClient: QueryClient
  }>()({
    errorComponent: ErrorComponent,
    component: context.parameters.router?.renderRootRoute
      ? () => {
          return (
            <>
              {context.parameters.router?.renderRootRoute?.(Story)}
              {context.parameters.enableTanstackRouterDevTools && (
                <TanStackRouterDevtools />
              )}
            </>
          )
        }
      : () => (
          <div className="uy:grid uy:grid-cols-[auto_1fr] uy:gap-100">
            <nav className="uy:flex uy:gap-100 uy:p-200">
              <Story />
            </nav>
            <main
              className="uy:p-300 uy:bg-surface-neutral uy:rounded-100 uy:shadow-floating uy:min-h-[50vh]"
              aria-live="polite"
            >
              <Outlet />
            </main>

            {context.parameters.enableTanstackRouterDevTools && (
              <TanStackRouterDevtools />
            )}
          </div>
        ),
  })
  // Create routes and handle nested structure

  function createRouteLoop(
    parentRoute: Route,
    children?: RouteConfig[],
  ): Route {
    if (children && children.length > 0) {
      const childRoutes = children.map((child: RouteConfig) => {
        const childRoute = createRoute({
          path: child.path,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
          getParentRoute: () => parentRoute as any,
          component: child.element === 'story' ? Story : child.element,
          // @ts-expect-error impossible to type correctly
          loader: child.loader,
          // @ts-expect-error impossible to type correctly
          beforeLoad: child.beforeLoad,
          validateSearch: child.validateSearch,
          // @ts-expect-error impossible to type correctly
          loaderDeps: child.loaderDeps,
        }) as unknown as Route

        if (child.children && child.children.length > 0) {
          createRouteLoop(childRoute, child.children)
        }
        return childRoute
      })
      parentRoute.addChildren(childRoutes)
    }
    return parentRoute
  }
  const createdRoutes = routes.map(
    ({ path, element, loader, children, ...rest }) => {
      const parentRoute = createRoute({
        path,
        getParentRoute: () => rootRoute as unknown as RootRoute,
        component: element === 'story' ? Story : element,
        loader,
        // @ts-expect-error impossible to type correctly
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        beforeLoad: rest.beforeLoad,
        // @ts-expect-error impossible to type correctly
        validateSearch: rest.validateSearch,
        // @ts-expect-error impossible to type correctly
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        loaderDeps: rest.loaderDeps,
      }) as unknown as Route

      // If this route has children, create and add them
      if (children && children.length > 0) {
        createRouteLoop(parentRoute, children)
      }

      return parentRoute
    },
  )

  rootRoute.addChildren(createdRoutes)

  // Collect all route paths including child routes for history
  const allPaths: string[] = []
  routes.forEach((route: RouteConfig) => {
    allPaths.push(route.path)
    if (route.children) {
      route.children.forEach((child: RouteConfig) => {
        // Construct full path for child routes
        const fullChildPath =
          route.path === '/' ? child.path : route.path + child.path
        allPaths.push(fullChildPath)
      })
    }
  })

  const history = createMemoryHistory({
    initialEntries: allPaths,
    initialIndex: allPaths.findIndex(path => path === initialPath),
  })

  const router = createRouter({
    history,
    routeTree: rootRoute,
    defaultNotFoundComponent: () => <div>Route not found</div>,
    context: {
      queryClient: new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            gcTime: 0,
            staleTime: 0,
          },
        },
      }),
    },
  })

  return <RouterProvider router={router} />
}
