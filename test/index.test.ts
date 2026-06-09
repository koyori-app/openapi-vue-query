import { describe, expect, it } from "vitest";
import {
  OpenApiVueQueryError,
  createClient,
  createQueryKey
} from "../src/index.js";

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
  };
};

describe("createQueryKey", () => {
  it("builds a stable key with init", () => {
    expect(
      createQueryKey<paths, "get", "/users/{userId}", { params: { path: { userId: number } } }>(
        "get",
        "/users/{userId}",
        {
        params: {
          path: { userId: 1 }
        }
      })
    ).toEqual([
      "get",
      "/users/{userId}",
      {
        params: {
          path: { userId: 1 }
        }
      }
    ]);
  });
});

describe("createClient", () => {
  it("creates query options that unwrap successful responses", async () => {
    const api = createClient<paths>({
      GET: async () => ({
        data: { id: 1 },
        error: undefined,
        response: new Response(null, { status: 200 })
      })
    } as any);

    const options = api.queryOptions("get", "/users/{userId}", {
      params: {
        path: { userId: 1 }
      }
    }) as {
      queryFn: () => Promise<unknown>;
      queryKey: unknown;
    };
    await expect(options.queryFn()).resolves.toEqual({ id: 1 });
    expect(options.queryKey).toEqual([
      "get",
      "/users/{userId}",
      {
        params: {
          path: { userId: 1 }
        }
      }
    ]);
  });

  it("throws a typed error for failed responses", async () => {
    const api = createClient<paths>({
      POST: async () => ({
        data: undefined,
        error: { message: "bad request" },
        response: new Response(null, { status: 400 })
      })
    } as any);

    const options = api.queryOptions("post", "/users", {
      body: {
        name: "Aki"
      }
    }) as {
      queryFn: () => Promise<unknown>;
    };

    await expect(options.queryFn()).rejects.toBeInstanceOf(OpenApiVueQueryError);
  });
});
