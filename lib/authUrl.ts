/**
 * Generate the auth/accounts IDM subdomain URL
 * Handles both http and https protocols
 */
export function getAuthURL(): string {
  const authSubdomain = process.env.AUTH_SUBDOMAIN || "accounts";
  const appSubdomain = process.env.APP_SUBDOMAIN || "whisperrnote.space";

  if (!appSubdomain) {
    throw new Error(
      "APP_SUBDOMAIN environment variable is required for auth URL generation",
    );
  }

  // Use http/https based on current protocol or default to https
  const protocol =
    typeof window !== "undefined" ? window.location.protocol : "https:";

  return `${protocol}//${authSubdomain}.${appSubdomain}`;
}

/**
 * Generate the source URL for IDM redirect with optional close parameter
 * Default targets /masterpass for authenticated users
 */
export function getSourceURL(includeClose: boolean = false): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : "";
    const url = `${protocol}//${hostname}${port}/masterpass`;
    return includeClose ? `${url}?close=yes` : url;
  }

  // Server-side fallback
  const appSubdomain = process.env.APP_SUBDOMAIN || "whisperrnote.space";
  const protocol = process.env.NODE_ENV === "development" ? "http:" : "https:";
  const url = `${protocol}//${appSubdomain}/masterpass`;
  return includeClose ? `${url}?close=yes` : url;
}

/**
 * Open the IDM authentication popup and handle outcomes
 */
export function openAuthPopup(): void {
  const authURL = getAuthURL();
  const sourceURL = getSourceURL(true); // Include ?close=yes
  const popup = window.open(
    `${authURL}?source=${encodeURIComponent(sourceURL)}`,
    "auth_popup",
    "width=500,height=700,resizable=yes,scrollbars=yes",
  );

  if (!popup) {
    throw new Error("Failed to open authentication popup. Please check popup settings.");
  }

  // Poll to detect if popup was closed without completing auth
  let pollCount = 0;
  const maxPolls = 600; // 10 minutes (600 * 1s)
  
  const pollPopup = setInterval(() => {
    pollCount++;
    
    // Check if popup is closed
    if (popup.closed) {
      clearInterval(pollPopup);
      // Redirect to IDM with close=yes parameter to indicate popup closure
      redirectToAuthIDM(true);
      return;
    }
    
    // Timeout after 10 minutes
    if (pollCount >= maxPolls) {
      clearInterval(pollPopup);
      popup.close();
      redirectToAuthIDM(true);
      return;
    }
  }, 1000);

  // Listen for messages from popup when authentication is complete
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== getAuthURL()) {
      return; // Ignore messages from other origins
    }

    if (event.data?.type === "auth_complete") {
      clearInterval(pollPopup);
      window.removeEventListener("message", handleMessage);
      // Navigate to masterpass when auth is successful
      window.location.href = "/masterpass";
    }
  };

  window.addEventListener("message", handleMessage);

  // Cleanup listener after 10 minutes (reasonable timeout for auth flow)
  const timeoutId = setTimeout(() => {
    clearInterval(pollPopup);
    window.removeEventListener("message", handleMessage);
  }, 10 * 60 * 1000);
}

/**
 * Redirect to the IDM when not authenticated
 * This sends the user to login/register in the IDM with source parameter
 * @param withClose - Whether to include ?close=yes parameter (for popup closure detection)
 */
export function redirectToAuthIDM(withClose: boolean = false): void {
  const authURL = getAuthURL();
  const sourceURL = getSourceURL(true); // Always include close parameter
  const redirectURL = withClose 
    ? `${authURL}?source=${encodeURIComponent(sourceURL)}&close=yes`
    : `${authURL}?source=${encodeURIComponent(sourceURL)}`;
  
  window.location.href = redirectURL;
}
