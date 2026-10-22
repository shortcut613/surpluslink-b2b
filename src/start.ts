// src/start.ts
import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next, request, ...rest }: any) => {
  try {
    return await next();
  } catch (error) {
    // Never return an HTML error page for serverFn RPC requests — doing so
    // corrupts the client-side Seroval/JSON stream reader and causes hanging pending states.
    const isServerFn =
      rest?.handlerType === "serverFn" ||
      (request && new URL(request.url).searchParams.has("_serverFnId")) ||
      request?.headers?.get("x-server-fn") !== null;

    if (isServerFn) {
      throw error;
    }

    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
