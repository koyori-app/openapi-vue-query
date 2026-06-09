import {
  queryOptions as buildQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery
} from "@tanstack/vue-query";
import type { QueryClient } from "@tanstack/vue-query";
import type {
  Client as FetchClient,
  DefaultParamsOption,
  MaybeOptionalInit
} from "openapi-fetch";
import type { HttpMethod, MediaType, PathsWithMethod } from "openapi-typescript-helpers";

type PathsMap = Record<string, Partial<Record<HttpMethod, {}>>>;

type InitWithUnknowns = { [key: string]: unknown };

export type QueryKey<
  Paths extends PathsMap,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init = unknown
> = Init extends undefined ? readonly [Method, Path] : readonly [Method, Path, Init];

export type MethodResponse<
  Paths extends PathsMap,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init = unknown,
  Media extends MediaType = MediaType
> = unknown;

export interface OpenApiVueQueryClient<
  Paths extends PathsMap = PathsMap,
  Media extends MediaType = MediaType
> {
  queryOptions: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    init?: InitWithUnknowns,
    options?: Record<string, unknown>
  ) => unknown;
  useQuery: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    init?: InitWithUnknowns,
    options?: Record<string, unknown>,
    queryClient?: QueryClient
  ) => unknown;
  useSuspenseQuery: OpenApiVueQueryClient<Paths, Media>["useQuery"];
  useInfiniteQuery: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    init: InitWithUnknowns,
    options: Record<string, unknown> & { pageParamName?: string },
    queryClient?: QueryClient
  ) => unknown;
  useMutation: <
    Method extends Exclude<HttpMethod, "get" | "head">,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    options?: Record<string, unknown>,
    queryClient?: QueryClient
  ) => unknown;
}

export class OpenApiVueQueryError<TError = unknown> extends Error {
  readonly error: TError;
  readonly response?: Response;

  constructor(error: TError, response?: Response) {
    super("OpenAPI request failed");
    this.name = "OpenApiVueQueryError";
    this.error = error;
    this.response = response;
  }
}

export function createQueryKey<
  Paths extends PathsMap,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init = unknown
>(method: Method, path: Path, init?: Init): QueryKey<Paths, Method, Path, Init> {
  return (init === undefined ? [method, path] : [method, path, init]) as unknown as QueryKey<
    Paths,
    Method,
    Path,
    Init
  >;
}

export function createClient<Paths extends PathsMap, Media extends MediaType = MediaType>(
  client: FetchClient<any, Media>
): OpenApiVueQueryClient<Paths, Media> {
  const runMethod = async <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    init: InitWithUnknowns | undefined,
    signal?: AbortSignal
  ): Promise<MethodResponse<Paths, Method, Path, Init, Media>> => {
    const methodName = method.toUpperCase() as Uppercase<Method>;
    const fn = client[methodName] as (path: string, init?: unknown) => Promise<any>;
    const result = await fn(path as string, {
      ...(init as object),
      signal
    });

    if (result.error) {
      throw new OpenApiVueQueryError(result.error, result.response);
    }

    if (
      result.response.status === 204 ||
      result.response.headers.get("Content-Length") === "0"
    ) {
      return (result.data ?? null) as MethodResponse<Paths, Method, Path, Init, Media>;
    }

    return result.data as MethodResponse<Paths, Method, Path, Init, Media>;
  };

  const queryOptions = <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init = unknown
  >(
    method: Method,
    path: Path,
    init?: InitWithUnknowns,
    options?: Record<string, unknown>
  ) =>
    buildQueryOptions({
      queryKey: createQueryKey<Paths, Method, Path, Init>(method, path, init as Init),
      queryFn: ({ signal } = { signal: undefined }) =>
        runMethod<Method, Path, Init>(method, path, init, signal),
      ...(options ?? {})
    } as never);

  return {
    queryOptions,
    useQuery: <
      Method extends HttpMethod,
      Path extends PathsWithMethod<Paths, Method>,
      Init = unknown
    >(
      method: Method,
      path: Path,
      init?: InitWithUnknowns,
      options?: Record<string, unknown>,
      queryClient?: QueryClient
    ) => useQuery(queryOptions(method, path, init, options), queryClient),
    useSuspenseQuery: <
      Method extends HttpMethod,
      Path extends PathsWithMethod<Paths, Method>,
      Init = unknown
    >(
      method: Method,
      path: Path,
      init?: InitWithUnknowns,
      options?: Record<string, unknown>,
      queryClient?: QueryClient
    ) =>
      useQuery(
        queryOptions(method, path, init, {
          ...(options ?? {}),
          suspense: true
        }),
        queryClient
      ),
    useInfiniteQuery: <
      Method extends HttpMethod,
      Path extends PathsWithMethod<Paths, Method>,
      Init = unknown
    >(
      method: Method,
      path: Path,
      init: InitWithUnknowns,
      options: Record<string, unknown> & { pageParamName?: string },
      queryClient?: QueryClient
    ) => {
      const { pageParamName = "cursor", ...restOptions } = options;
      return useInfiniteQuery(
        {
          queryKey: createQueryKey<Paths, Method, Path, Init>(method, path, init as Init),
          queryFn: async ({ pageParam = 0, signal }: { pageParam?: unknown; signal?: AbortSignal }) => {
            const methodName = method.toUpperCase() as Uppercase<Method>;
            const fn = client[methodName] as (path: string, init?: unknown) => Promise<any>;
            const mergedInit = {
              ...init,
              signal,
              params: {
                ...(init.params ?? {}),
                query: {
                  ...((init.params as { query?: DefaultParamsOption } | undefined)?.query ?? {}),
                  [pageParamName]: pageParam
                }
              }
            };
            const result = await fn(path as string, mergedInit);

            if (result.error) {
              throw new OpenApiVueQueryError(result.error, result.response);
            }

            return result.data;
          },
          ...(restOptions as object)
        } as never,
        queryClient
      );
    },
    useMutation: <
      Method extends Exclude<HttpMethod, "get" | "head">,
      Path extends PathsWithMethod<Paths, Method>,
      Init = unknown
    >(
      method: Method,
      path: Path,
      options?: Record<string, unknown>,
      queryClient?: QueryClient
    ) =>
      useMutation(
        {
          mutationKey: [method, path],
          mutationFn: async (init: InitWithUnknowns) => runMethod(method, path, init),
          ...(options ?? {})
        } as never,
        queryClient
      )
  };
}
