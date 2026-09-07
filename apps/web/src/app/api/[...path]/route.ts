import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const API_ORIGIN = process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const targetUrl = new URL(`/api/${path.join("/")}`, API_ORIGIN);
  targetUrl.search = request.nextUrl.search;

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const isBodyAllowed = request.method !== "GET" && request.method !== "HEAD";
    const body = isBodyAllowed ? await request.arrayBuffer() : undefined;

    const backendResponse = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: reqHeaders,
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    const resHeaders = new Headers(backendResponse.headers);
    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: resHeaders,
    });
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

