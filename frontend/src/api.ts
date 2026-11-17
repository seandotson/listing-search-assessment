export async function getJSON<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = Array.isArray(body?.detail)
      ? body.detail.map((error: { msg: string }) => error.msg).join(". ")
      : "Unable to load data. Check that the Python API is running and try again.";
    throw new Error(message);
  }
  return response.json();
}
