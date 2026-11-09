import { assertPublicUrl } from "./ssrfGuard";

// Lector de solo lectura de repositorios de GitHub, vía API pública. Si existe
// GITHUB_TOKEN en el entorno se usa para subir el límite de peticiones (de 60
// a 5000/hora); si no, funciona sin autenticar con repos públicos.

export type RepoRef = { owner: string; repo: string };

export function parseGitHubUrl(raw: string): RepoRef | null {
  try {
    const u = new URL(raw);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const parts = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GuardianToolsIT/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function ghFetch(url: string): Promise<Response | null> {
  const check = await assertPublicUrl(url);
  if (!check.ok) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(check.url.toString(), { headers: authHeaders(), signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getDefaultBranch(ref: RepoRef): Promise<string | null> {
  const res = await ghFetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { default_branch?: string };
  return data.default_branch ?? null;
}

export type TreeEntry = { path: string; type: string; size?: number };

export async function getTree(ref: RepoRef, branch: string): Promise<TreeEntry[]> {
  const res = await ghFetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  if (!res || !res.ok) return [];
  const data = (await res.json()) as { tree?: TreeEntry[] };
  return (data.tree ?? []).filter((e) => e.type === "blob");
}

// Contenido crudo de un archivo (bounded). Usa raw.githubusercontent para no
// gastar cuota de API en cada archivo.
export async function getFileContent(ref: RepoRef, branch: string, path: string, maxBytes = 200_000): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${encodeURIComponent(branch)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const check = await assertPublicUrl(url);
  if (!check.ok) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(check.url.toString(), {
      headers: { "User-Agent": "GuardianToolsIT/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let out = "";
    let total = 0;
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      out += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
