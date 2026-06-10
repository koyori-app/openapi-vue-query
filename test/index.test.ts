import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  OpenApiVueQueryError,
  createClient,
  createQueryKey,
} from "../src/index.js";

// --------------------------------------------------------------------------
// Shared path types
// --------------------------------------------------------------------------

type paths = {
  "/users/{userId}": {
    get: {
      parameters: {
        path: {
          userId: number;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              id: number;
              name: string;
            };
          };
        };
      };
    };
  };
  "/users": {
    post: {
      requestBody: {
        content: {
          "application/json": {
            name: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            "application/json": {
              ok: true;
            };
          };
        };
        400: {
          content: {
            "application/json": {
              message: string;
            };
          };
        };
      };
    };
    get: {
      parameters: {
        query?: {
          cursor?: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": {
              items: { id: number }[];
              nextCursor?: string;
            };
          };
        };
      };
    };
  };
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function makeQueryFn(options: ReturnType<ReturnType<typeof createClient<paths>>["queryOptions"]>) {
  return options.queryFn as (ctx?: { signal?: AbortSignal }) => Promise<unknown>;
}

// --------------------------------------------------------------------------
// createQueryKey
// --------------------------------------------------------------------------

describe("createQueryKey", () => {
  it("returns [method, path, init] when init is provided", () => {
    expect(
      createQueryKey<paths, "get", "/users/{userId}", { params: { path: { userId: number } } }>(
        "get",
        "/users/{userId}",
        { params: { path: { userId: 1 } } }
      )
    ).toEqual(["get", "/users/{userId}", { params: { path: { userId: 1 } } }]);
  });

  it("returns [method, path] when init is omitted", () => {
    expect(createQueryKey<paths, "get", "/users/{userId}">("get", "/users/{userId}")).toEqual([
      "get",
      "/users/{userId}",
    ]);
  });
});

// --------------------------------------------------------------------------
// OpenApiVueQueryError
// --------------------------------------------------------------------------

describe("OpenApiVueQueryError", () => {
  it("stores error and response", () => {
    const res = new Response(null, { status: 400 });
    const err = new OpenApiVueQueryError({ message: "bad" }, res);
    expect(err).toBeInstanceOf(OpenApiVueQueryError);
    expect(err.error).toEqual({ message: "bad" });
    expect(err.response).toBe(res);
    expect(err.name).toBe("OpenApiVueQueryError");
    expect(err.message).toBe("OpenAPI request failed");
  });

  it("works without response argument", () => {
    const err = new OpenApiVueQueryError("something went wrong");
    expect(err.error).toBe("something went wrong");
    expect(err.response).toBeUndefined();
  });
});

// --------------------------------------------------------------------------
// queryOptions – queryFn behavior
// --------------------------------------------------------------------------

describe("queryOptions", () => {
  describe("queryFn", () => {
    it("returns data on successful 200 response", async () => {
      const api = createClient<paths>({
        GET: async () => ({
          data: { id: 1, name: "Alice" },
          error: undefined,
          response: new Response(null, { status: 200 }),
        }),
      } as any);

      const fn = makeQueryFn(
        api.queryOptions("get", "/users/{userId}", { params: { path: { userId: 1 } } })
      );
      await expect(fn()).resolves.toEqual({ id: 1, name: "Alice" });
    });

    it("throws OpenApiVueQueryError on error response", async () => {
      const api = createClient<paths>({
        POST: async () => ({
          data: undefined,
          error: { message: "bad request" },
          response: new Response(null, { status: 400 }),
        }),
      } as any);

      const fn = makeQueryFn(api.queryOptions("post", "/users", { body: { name: "Aki" } }));
      await expect(fn()).rejects.toBeInstanceOf(OpenApiVueQueryError);
    });

    it("error instance carries .error and .response", async () => {
      const mockResponse = new Response(null, { status: 400 });
      const api = createClient<paths>({
        POST: async () => ({
          data: undefined,
          error: { message: "bad request" },
          response: mockResponse,
        }),
      } as any);

      const fn = makeQueryFn(api.queryOptions("post", "/users", { body: { name: "Aki" } }));
      const err = await fn().catch((e) => e);
    expect(err).toBeInstanceOf(OpenApiVueQueryError);
    if (err instanceof OpenApiVueQueryError) {
      expect(err.error).toEqual({ message: "bad request" });
      expect(err.response).toBe(mockResponse);
    }
    });

    it("returns null for 204 No Content", async () => {
      const api = createClient<paths>({
        GET: async () => ({
          data: undefined,
          error: undefined,
          response: new Response(null, { status: 204 }),
        }),
      } as any);

      const fn = makeQueryFn(
        api.queryOptions("get", "/users/{userId}", { params: { path: { userId: 1 } } })
      );
      await expect(fn()).resolves.toBeNull();
    });

    it("returns null when Content-Length is 0", async () => {
      const api = createClient<paths>({
        GET: async () => ({
          data: undefined,
          error: undefined,
          response: new Response(null, {
            status: 200,
            headers: { "Content-Length": "0" },
          }),
        }),
      } as any);

      const fn = makeQueryFn(
        api.queryOptions("get", "/users/{userId}", { params: { path: { userId: 1 } } })
      );
      await expect(fn()).resolves.toBeNull();
    });

    it("forwards the AbortSignal to the fetch function", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        data: { id: 1, name: "Alice" },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const api = createClient<paths>({ GET: fetchSpy } as any);
      const controller = new AbortController();

      const fn = makeQueryFn(
        api.queryOptions("get", "/users/{userId}", { params: { path: { userId: 1 } } })
      );
      await fn({ signal: controller.signal });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const callInit = fetchSpy.mock.calls[0][1];
      expect(callInit.signal).toBe(controller.signal);
    });
  });

  describe("queryKey", () => {
    it("includes init when init is provided", () => {
      const api = createClient<paths>({ GET: vi.fn() } as any);
      const opts = api.queryOptions("get", "/users/{userId}", { params: { path: { userId: 1 } } });
      expect(opts.queryKey).toEqual(["get", "/users/{userId}", { params: { path: { userId: 1 } } }]);
    });

    it("omits init segment when no init is provided", () => {
      const api = createClient<paths>({ GET: vi.fn() } as any);
      const opts = api.queryOptions("get", "/users");
      expect(opts.queryKey).toHaveLength(2);
      expect(opts.queryKey).toEqual(["get", "/users"]);
    });
  });
});

// --------------------------------------------------------------------------
// Type inference (compile-time checks via expectTypeOf)
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Type inference tests
// Composable tests use it.skip(): never execute at runtime (Vue context
// unavailable outside setup()), but TypeScript and Vitest --typecheck
// still verify the types. A broken type → typecheck failure, not a skip.
// --------------------------------------------------------------------------

describe("type inference", () => {
  it.skip("useQuery data type is inferred from path and method", () => {
    const api = createClient<paths>({} as any);
    const result = api.useQuery("get", "/users/{userId}", { params: { path: { userId: 1 } } });
    expectTypeOf(result.data.value).toMatchTypeOf<{ id: number; name: string } | undefined>();
  });

  it.skip("useQuery data type narrows through select", () => {
    const api = createClient<paths>({} as any);
    const result = api.useQuery(
      "get",
      "/users/{userId}",
      { params: { path: { userId: 1 } } },
      { select: (user: { id: number; name: string }) => user.name }
    );
    expectTypeOf(result.data.value).toMatchTypeOf<string | undefined>();
  });

  it.skip("useQuery error type is not never", () => {
    const api = createClient<paths>({} as any);
    const result = api.useQuery("get", "/users/{userId}", { params: { path: { userId: 1 } } });
    expectTypeOf(result.error.value).not.toBeNever();
  });

  it("MethodResponse extracts response data type", () => {
    type Response = import("../src/index.js").MethodResponse<
      ReturnType<typeof createClient<paths>>,
      "get",
      "/users/{userId}"
    >;
    expectTypeOf<Response>().toMatchTypeOf<{ id: number; name: string }>();
  });

  it.skip("useMutation variables type is not never", () => {
    const api = createClient<paths>({} as any);
    const result = api.useMutation("post", "/users");
    type MutateVars = Parameters<typeof result.mutate>[0];
    expectTypeOf<MutateVars>().not.toBeNever();
  });
});
