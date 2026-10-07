const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";

function resolveMountPath() {
  if (configuredAppUrl) {
    try {
      const pathname = new URL(configuredAppUrl).pathname.replace(/\/+$/, "");
      if (pathname && pathname !== "/") {
        return pathname.startsWith("/") ? pathname : `/${pathname}`;
      }

      // A standalone deployment such as https://troninbox.com has no mount
      // prefix. Do not fall through to the embedded /inbox default when the
      // configured app URL explicitly points at the domain root.
      return "";
    } catch {
      // Fall through to the embedded production default below.
    }
  }

  // Railway's production build can compile the app before NODE_ENV is exposed
  // to the server bundle. The platform environment is the authoritative
  // deployment signal, so keep the mounted route in that case as well.
  return process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_NAME === "production" ? "/inbox" : "";
}

export const APP_MOUNT_PATH = resolveMountPath();

/**
 * Converts an Inbox-internal URL into the URL visible through an optional
 * embedded `/inbox/` workspace. Standalone TRON Mail remains rooted at `/`.
 */
export function appPath(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (!APP_MOUNT_PATH || normalizedPath === APP_MOUNT_PATH || normalizedPath.startsWith(`${APP_MOUNT_PATH}/`)) {
    return normalizedPath;
  }

  return `${APP_MOUNT_PATH}${normalizedPath}`;
}

/**
 * Normalizes a browser pathname back to the Inbox-internal route used by the
 * existing mail UI state checks.
 */
export function stripAppMount(pathname: string) {
  if (!APP_MOUNT_PATH || pathname === APP_MOUNT_PATH) {
    return pathname || "/";
  }

  return pathname.startsWith(`${APP_MOUNT_PATH}/`)
    ? pathname.slice(APP_MOUNT_PATH.length) || "/"
    : pathname;
}
