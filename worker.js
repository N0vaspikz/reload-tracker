const ALLOWED_ORIGIN = "https://n0vaspikz.github.io";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) }
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function validCatalogue(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items) || data.items.length > 1000) return false;
  const ids = new Set();
  for (const item of data.items) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.image !== "string") return false;
    if (!/^[med][0-9]{2,}$/.test(item.id) || item.name.trim().length < 1 || item.name.length > 100) return false;
    if (!["mythic", "exotic", "dev"].includes(item.category)) return false;
    const expectedPrefix = item.category === "mythic" ? "m" : item.category === "exotic" ? "e" : "d";
    if (!item.id.startsWith(expectedPrefix) || ids.has(item.id)) return false;
    if (!/^[A-Za-z0-9_-]+\.(png|webp|jpg|jpeg|avif)$/i.test(item.image)) return false;
    ids.add(item.id);
  }
  return true;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden origin", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return json({ error: "Use POST to publish a catalogue." }, 405, origin);
    if (!env.ADMIN_PASSWORD || !env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return json({ error: "Publisher is missing required Cloudflare secrets or variables." }, 500, origin);
    }
    const supplied = request.headers.get("X-Admin-Password") || "";
    if (!supplied || supplied !== env.ADMIN_PASSWORD) return json({ error: "Incorrect admin password." }, 401, origin);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400, origin);
    }
    if (!validCatalogue(data)) return json({ error: "Catalogue failed validation. Check IDs, categories, names and image filenames." }, 400, origin);

    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Reload-Tracker-Catalogue-Publisher"
    };
    const base = "https://api.github.com/repos/" + repo + "/contents/items.json";
    try {
      const current = await fetch(base + "?ref=" + encodeURIComponent(branch), { headers });
      if (!current.ok) {
        const detail = await current.text();
        return json({ error: "Could not read items.json from GitHub (" + current.status + "): " + detail.slice(0, 240) }, 502, origin);
      }
      const file = await current.json();
      const content = JSON.stringify(data, null, 2) + "\n";
      const encoded = bytesToBase64(new TextEncoder().encode(content));
      const update = await fetch(base, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update Reload tracker catalogue",
          content: encoded,
          sha: file.sha,
          branch
        })
      });
      const result = await update.json().catch(() => ({}));
      if (!update.ok) return json({ error: result.message || "GitHub rejected the catalogue update." }, 502, origin);
      return json({ ok: true, commit: result.commit && result.commit.sha ? result.commit.sha.slice(0, 12) : "created" }, 200, origin);
    } catch (error) {
      return json({ error: "Publisher request failed: " + String(error && error.message || error) }, 502, origin);
    }
  }
};
