"use client";

/**
 * Error logging utility for client-side error reporting
 */
export function logErrorToBackend(error: Error, context: { route?: string } = {}): void {
  try {
    // In production, this would send the error to a backend service
    // For now, we'll just log to console
    console.error("Error logged:", {
      message: error.message,
      stack: error.stack,
      route: context.route,
      timestamp: new Date().toISOString(),
    });

    // You could also send to an error tracking service here
    // Example:
    // fetch('/api/log-error', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     message: error.message,
    //     stack: error.stack,
    //     route: context.route,
    //     timestamp: new Date().toISOString(),
    //   }),
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    // });
  } catch (loggingError) {
    // If error logging itself fails, just log to console
    console.error("Failed to log error:", loggingError);
  }
}