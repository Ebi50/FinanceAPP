import { NextResponse } from 'next/server';
import { getSessionUser, type SessionUser } from './auth';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
}

/** Wraps a handler so thrown HttpErrors become responses and nothing else leaks. */
export async function route(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}

/** Like route(), but rejects requests without a valid session first. */
export async function authed(fn: (user: SessionUser) => Promise<Response>): Promise<Response> {
  return route(async () => {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, 'Nicht angemeldet.');
    return fn(user);
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Ungültiger Request-Body.');
  }
}

/** Turns a zod safeParse result into data or a 400. */
export function parsed<T>(result: { success: boolean; data?: T; error?: { message: string } }): T {
  if (!result.success) {
    throw new HttpError(400, 'Ungültige Eingabe.');
  }
  return result.data as T;
}
