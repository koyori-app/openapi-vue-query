import {
  type DataTag,
  type InfiniteData,
  type QueryClient,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryReturnType,
  type UseMutationOptions,
  type UseMutationReturnType,
  type UseQueryOptions,
  type UseQueryReturnType,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from "@tanstack/vue-query";
import type {
  DefaultParamsOption,
  Client as FetchClient,
  FetchResponse,
  MaybeOptionalInit,
} from "openapi-fetch";
import type { HttpMethod, MediaType, PathsWithMethod, RequiredKeysOf } from "openapi-typescript-helpers";

type PathsMap = Record<string, Partial<Record<HttpMethod, {}>>>;

type InitWithUnknowns<Init> = Init & { [key: string]: unknown };

// NonNullable strips `undefined` introduced by Partial<Record<HttpMethod, {}>>
// so that FetchResponse<T> always receives a defined operation type.
type SafeResponse<
  Paths extends PathsMap,
  Path extends keyof Paths,
  Method,
  Init
> = Required<FetchResponse<NonNullable<Paths[Path] extends Record<string, any> ? Paths[Path][Method & keyof Paths[Path]] : never>, Init, any>>;

export type QueryKey<
  Paths extends PathsMap,
  Method extends HttpMethod,
  Path extends PathsWithMethod<Paths, Method>,
  Init = MaybeOptionalInit<Paths[Path], Method>
> = Init extends undefined ? readonly [Method, Path] : readonly [Method, Path, Init];

export type MethodResponse<
  CreatedClient extends OpenApiVueQueryClient<any, any>,
  Method extends HttpMethod,
  Path extends CreatedClient extends OpenApiVueQueryClient<infer Paths, infer _Media>
    ? PathsWithMethod<Paths, Method>
    : never,
  Options = object
> =
  CreatedClient extends OpenApiVueQueryClient<
    infer Paths extends { [key: string]: any },
    infer Media extends MediaType
  >
    ? NonNullable<FetchResponse<Paths[Path][Method], Options, Media>["data"]>
    : never;

export interface OpenApiVueQueryClient<
  Paths extends PathsMap = PathsMap,
  Media extends MediaType = MediaType
> {
  queryOptions: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init extends MaybeOptionalInit<Paths[Path], Method>
  >(
    method: Method,
    path: Path,
    ...[init, options]: RequiredKeysOf<Init> extends never
      ? [InitWithUnknowns<Init>?, UseQueryOptions?]
      : [InitWithUnknowns<Init>, UseQueryOptions?]
  ) => {
    queryKey: DataTag<QueryKey<Paths, Method, Path>, any, any>;
    queryFn: (...args: any[]) => Promise<any>;
    [key: string]: any;
  };
  useQuery: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init extends MaybeOptionalInit<Paths[Path], Method>,
    Response extends SafeResponse<Paths, Path, Method, Init> = SafeResponse<Paths, Path, Method, Init>,
    TSelectData = Response["data"]
  >(
    method: Method,
    path: Path,
    ...[init, options, queryClient]: RequiredKeysOf<Init> extends never
      ? [
          InitWithUnknowns<Init>?,
          Omit<UseQueryOptions<Response["data"], Response["error"], TSelectData, Response["data"], QueryKey<Paths, Method, Path>>, "queryKey" | "queryFn">?,
          QueryClient?
        ]
      : [
          InitWithUnknowns<Init>,
          Omit<UseQueryOptions<Response["data"], Response["error"], TSelectData, Response["data"], QueryKey<Paths, Method, Path>>, "queryKey" | "queryFn">?,
          QueryClient?
        ]
  ) => UseQueryReturnType<TSelectData, Response["error"]>;
  /**
   * @deprecated Vue Query v5 does not have a dedicated `useSuspenseQuery`.
   * Use `useQuery` instead and wrap the component with `<Suspense>`.
   * This method is an alias for `useQuery` kept for API compatibility.
   */
  useSuspenseQuery: OpenApiVueQueryClient<Paths, Media>["useQuery"];
  useInfiniteQuery: <
    Method extends HttpMethod,
    Path extends PathsWithMethod<Paths, Method>,
    Init extends MaybeOptionalInit<Paths[Path], Method>,
    Response extends SafeResponse<Paths, Path, Method, Init> = SafeResponse<Paths, Path, Method, Init>,
    TPageParam = unknown,
    TSelectData = Response["data"]
  >(
    method: Method,
    path: Path,
    init: InitWithUnknowns<Init>,
    options: UseInfiniteQueryOptions<Response["data"], Response["error"], TSelectData, QueryKey<Paths, Method, Path>, TPageParam>,
    pageParamName?: string,
    queryClient?: QueryClient
  ) => UseInfiniteQueryReturnType<TSelectData, Response["error"]>;
  useMutation: <
    Method extends Exclude<HttpMethod, "get" | "head">,
    Path extends PathsWithMethod<Paths, Method>,
    Init extends MaybeOptionalInit<Paths[Path], Method>,
    Response extends SafeResponse<Paths, Path, Method, Init> = SafeResponse<Paths, Path, Method, Init>,
    TOnMutateResult = unknown
  >(
    method: Method,
    path: Path,
    options?: Omit<
      UseMutationOptions<Response["data"], Response["error"], Init, TOnMutateResult>,
      "mutationKey" | "mutationFn"
    >,
    queryClient?: QueryClient
  ) => UseMutationReturnType<Response["data"], Response["error"], Init, TOnMutateResult>;
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

type AnyFetchFn = (path: string, init?: unknown) => Promise<{
  data: any;
  error: any;
  response: Response;
}>;

export function createClient<Paths extends PathsMap, Media extends MediaType = MediaType>(
  client: FetchClient<any, Media>
): OpenApiVueQueryClient<Paths, Media> {
  const callMethod = (method: string, path: string, init: unknown, signal?: AbortSignal) => {
    const fn = (client as any)[method.toUpperCase()] as AnyFetchFn;
    return fn(path, { ...(init as object), signal });
  };

  const queryOptions = (
    method: string,
    path: string,
    init?: unknown,
    options?: UseQueryOptions
  ) => ({
    queryKey: (
      init === undefined ? ([method, path] as const) : ([method, path, init] as const)
    ) as DataTag<any, any, any>,
    queryFn: ({ signal }: { signal?: AbortSignal } = {}) =>
      callMethod(method, path, init, signal).then(({ data, error, response }) => {
        if (error) {
          throw new OpenApiVueQueryError(error, response);
        }
        if (response.status === 204 || response.headers.get("Content-Length") === "0") {
          return data ?? null;
        }
        return data;
      }),
    ...(options ?? {}),
  });

  return {
    queryOptions: queryOptions as OpenApiVueQueryClient<Paths, Media>["queryOptions"],
    useQuery: (method: any, path: any, ...[init, options, queryClient]: any[]) =>
      useQuery(queryOptions(method, path, init, options) as any, queryClient) as any,
    useSuspenseQuery: (method: any, path: any, ...[init, options, queryClient]: any[]) =>
      useQuery(queryOptions(method, path, init, options) as any, queryClient) as any,
    useInfiniteQuery: (method: any, path: any, init: any, options: any, pageParamName = "cursor", queryClient?: QueryClient) => {
      return useInfiniteQuery(
        {
          queryKey: (
            init === undefined ? ([method, path] as const) : ([method, path, init] as const)
          ) as any,
          queryFn: async ({
            queryKey: [method, path, init],
            pageParam = 0,
            signal,
          }: any) => {
            const mergedInit = {
              ...init,
              signal,
              params: {
                ...(init?.params ?? {}),
                query: {
                  ...(init?.params as { query?: DefaultParamsOption } | undefined)?.query,
                  [pageParamName]: pageParam,
                },
              },
            };
            const { data, error } = await callMethod(method, path, mergedInit);
            if (error) {
              throw new OpenApiVueQueryError(error);
            }
            return data;
          },
          ...options,
        } as any,
        queryClient
      ) as any;
    },
    useMutation: (method: any, path: any, options?: any, queryClient?: QueryClient) =>
      useMutation(
        {
          mutationKey: [method, path],
          mutationFn: async (init: unknown) => {
            const { data, error } = await callMethod(method, path, init);
            if (error) {
              throw new OpenApiVueQueryError(error);
            }
            return data;
          },
          ...(options ?? {}),
        } as any,
        queryClient
      ) as any,
  };
}
