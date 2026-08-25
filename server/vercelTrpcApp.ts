import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

/**
 * A focused serverless handler for Vercel's /api/trpc routes. The browser-only
 * workspace does not depend on Manus OAuth, storage proxy, or a persistent app server.
 */
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));
app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
