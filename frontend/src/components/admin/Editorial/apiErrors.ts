// Turns a failed backend response into an Error with the server's own explanation
// (FastAPI puts it in `detail`, domain errors in `message`).
export async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { detail?: unknown; message?: unknown } | null;
  const detail = typeof body?.detail === "string" ? body.detail : null;
  const message = typeof body?.message === "string" ? body.message : null;
  if (response.status === 401) return new Error("La sesión caducó; vuelve a iniciar sesión");
  return new Error(message || detail || `HTTP ${response.status}`);
}
