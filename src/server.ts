import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { GoogleGenAI } from "@google/genai";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

const SURPLUSLINK_SYSTEM_PROMPT = `
You are the official AI Support Assistant for SurplusLink, a platform dedicated to eliminating food waste and fighting hunger by connecting food donors with verified NGOs across South Africa.

==================================================
CORE MISSION
==================================================
SurplusLink ensures edible food feeds people, not landfills, by:
1. Redirecting excess food from businesses to community organizations.
2. Enabling verified non-profits, shelters, and food banks to access fresh supplies quickly.
3. Ensuring food safety through mandatory administrative verification for NGOs.
4. Optimizing collection routes and distances to simplify logistics.

==================================================
USER ROLES & WORKFLOWS
==================================================
1. Donors:
   - Businesses that create food donation batches with quantity, category, and expiry details.
   - Can immediately publish listings, view donation history, and check impact records.

2. NGOs:
   - Must register and undergo mandatory Admin Verification (submitting organization details and food safety compliance info).
   - Unverified NGOs can browse listings but CANNOT claim food until an admin approves them.
   - Verified NGOs browse listings, claim available batches, and access pickup instructions with verification PINs.

3. Logistics & Notifications:
   - Addresses and distance calculations are tailored for South Africa.
   - Delivery tracking provides simulated route progress, ETAs, and collection phases.
   - Automated email notifications send confirmation details and pickup PINs to both parties.

4. Security:
   - Updates to sensitive user information (address, contact numbers) require Zero Trust Multi-Factor Authentication (MFA) verification codes.

==================================================
RESPONSE RULES
==================================================
- Maintain a helpful, clear, and professional tone.
- Restrict responses strictly to SurplusLink operations, registration steps, verification rules, and donation logistics.
- Politeness state you only answer SurplusLink-related questions if prompted on unrelated topics.
`;

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // 1. Intercept POST /api/chat requests for Gemini AI Assistant
    if (request.method === "POST" && url.pathname === "/api/chat") {
      try {
        const body = (await request.json()) as { message?: string; history?: any[] };
        const { message, history } = body;

        if (!message) {
          return new Response(JSON.stringify({ error: "Message is required." }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        // Retrieve API Key from standard runtime env or process.env
        const apiKey = (env as any)?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

        if (!apiKey) {
          console.error(
            "Gemini Configuration Error: GEMINI_API_KEY is missing from environment variables.",
          );
          return new Response(
            JSON.stringify({ error: "Server configuration error: Missing API key." }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Filter & format chat history to match standard Gemini contents schema
        const formattedHistory = (history || [])
          .filter((item) => item.parts && item.parts[0]?.text?.trim() !== "")
          .map((item) => ({
            role: item.role === "assistant" ? "model" : item.role,
            parts: item.parts,
          }));

        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: [...formattedHistory, { role: "user", parts: [{ text: message }] }],
          config: {
            systemInstruction: SURPLUSLINK_SYSTEM_PROMPT,
          },
        });

        return new Response(JSON.stringify({ reply: aiResponse.text }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (error: any) {
        console.error("Gemini API Error in server handler:", error?.message || error);
        return new Response(
          JSON.stringify({ error: error?.message || "Failed to process request with AI model." }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // 2. Default SSR Handler Flow
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
