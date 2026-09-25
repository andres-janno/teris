// src/server/authGate.ts — ajutine: Task 4 lisab sessioonid ja /api/auth/*.
import type { IncomingMessage, ServerResponse } from 'http';
import type { ApiOptions } from './apiHandler';

export async function authGate(
  _req: IncomingMessage,
  _res: ServerResponse,
  _pathname: string,
  _method: string,
  _options: ApiOptions
): Promise<boolean> {
  return false;
}
