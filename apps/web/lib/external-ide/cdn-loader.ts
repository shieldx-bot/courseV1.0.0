"use client";

/**
 * Loads external scripts/styles from multiple CDNs with automatic fallback.
 * All resources come from third-party CDNs — zero payload on our servers.
 */

const loaded = new Map<string, Promise<unknown>>();

export interface CdnResource {
  /** Primary CDN URL */
  url: string;
  /** Fallback CDN URLs in priority order */
  fallbacks?: string[];
  /** Set true for stylesheets */
  style?: boolean;
  /** Check global variable after load (e.g. "CodeMirror") */
  checkGlobal?: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-cdn-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.cdnSrc = src;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  });
}

function loadStyle(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLLinkElement>(`link[data-cdn-href="${href}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load style ${href}`)), { once: true });
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.cdnHref = href;
    link.onload = () => {
      link.dataset.loaded = "true";
      resolve();
    };
    link.onerror = () => {
      link.remove();
      reject(new Error(`Failed to load style ${href}`));
    };
    document.head.appendChild(link);
  });
}

function checkGlobal(key: string): boolean {
  try {
    const value = key.split(".").reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], window);
    return value != null;
  } catch {
    return false;
  }
}

/**
 * Load a resource trying each CDN in order until one succeeds.
 * Returns true if at least one CDN succeeded.
 */
export async function loadCdnResource(resource: CdnResource): Promise<boolean> {
  const urls = [resource.url, ...(resource.fallbacks ?? [])];

  const cacheKey = `${resource.style ? "style" : "script"}:${urls.join("|")}`;
  if (loaded.has(cacheKey)) {
    try {
      await loaded.get(cacheKey);
      return true;
    } catch {
      return false;
    }
  }

  const promise = (async () => {
    let lastError: unknown;
    for (const url of urls) {
      try {
        if (resource.style) {
          await loadStyle(url);
        } else {
          await loadScript(url);
        }
        if (resource.checkGlobal && !checkGlobal(resource.checkGlobal)) {
          throw new Error(`${resource.checkGlobal} not available after load`);
        }
        return true;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError ?? new Error("All CDNs failed");
  })();

  loaded.set(cacheKey, promise);
  try {
    await promise;
    return true;
  } catch {
    loaded.delete(cacheKey);
    return false;
  }
}

/** Clear the in-memory load cache (useful when re-mounting). */
export function clearCdnCache(): void {
  loaded.clear();
}