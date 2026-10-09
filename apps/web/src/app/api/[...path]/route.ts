import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function getApiOrigin(): string {
  const origin = (
    process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  )
    .trim()
    .replace(/\/+$/, "");
  return origin.replace(/\/api$/, "");
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const apiOrigin = getApiOrigin();
  const segments = (path || []).filter(Boolean);
  if (segments[0] === "api") {
    segments.shift();
  }
  const targetUrl = new URL(`${apiOrigin}/api/${segments.join("/")}`);
  targetUrl.search = request.nextUrl.search;

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");
  reqHeaders.delete("connection");
  reqHeaders.delete("keep-alive");
  reqHeaders.delete("content-length");
  reqHeaders.delete("accept-encoding");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const isBodyAllowed = request.method !== "GET" && request.method !== "HEAD";
    let body: ArrayBuffer | undefined = undefined;
    if (isBodyAllowed) {
      try {
        const buf = await request.arrayBuffer();
        if (buf.byteLength > 0) {
          body = buf;
        }
      } catch {
        body = undefined;
      }
    }

    const backendResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: reqHeaders,
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // If upstream Render returns no-server, the backend service is down or misconfigured
    const renderRouting = backendResponse.headers.get("x-render-routing");
    if (backendResponse.status === 404 && renderRouting === "no-server") {
      console.error(
        `Next.js proxy: upstream backend at ${targetUrl.toString()} returned no-server (service down or misconfigured API_ORIGIN)`,
      );
      return NextResponse.json(
        {
          detail: `Backend service at ${apiOrigin} is unreachable or not running on Render (x-render-routing: no-server). Please verify that the LegalAI-API service is active.`,
        },
        { status: 502 },
      );
    }

    const STRIP_RESPONSE_HEADERS = new Set([
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection",
      "keep-alive",
      "set-cookie",
    ]);

    const resHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
        resHeaders.set(key, value);
      }
    });

    const isNoContent =
      backendResponse.status === 204 ||
      backendResponse.status === 304 ||
      request.method === "HEAD";

    const responseBody = isNoContent ? null : await backendResponse.arrayBuffer();

    const response = new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: resHeaders,
    });

    // Relay Set-Cookie headers individually to preserve cookie attributes and multi-cookie responses
    const setCookies =
      typeof backendResponse.headers.getSetCookie === "function"
        ? backendResponse.headers.getSetCookie()
        : backendResponse.headers.get("set-cookie")
          ? [backendResponse.headers.get("set-cookie")!]
          : [];

    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }

    return response;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.error("Next.js proxy error forwarding to", targetUrl.toString(), err);
    return NextResponse.json(
      { detail: "Backend analysis service unreachable or timed out." },
      { status: 504 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
export const HEAD = proxyRequest;
