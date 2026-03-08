import { captureException as sentryCaptureException } from "@sentry/react-router";
import { useEffect } from "react";
import GA4 from "react-ga4";

/**
 * Call this once in the root component to initialize Google Analytics.
 */
export function useGoogleAnalytics() {
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
    if (measurementId) GA4.initialize(measurementId);
  }, []);
}

/**
 * Track an event in Google Analytics.
 *
 * @param action - The action of the event.
 * @param params - The parameters for the event.
 * @param params.category - The category of the event.
 * @param params.label - The label of the event.
 * @param params.value - The value of the event.
 * @see https://developers.google.com/tag-platform/gtagjs/reference/events
 */
export function trackEvent(
  action: string,
  params: {
    category: string;
    label?: string;
    value?: number;
  },
) {
  if (!import.meta.env.PROD) return;

  try {
    GA4.event({
      action,
      category: params.category,
      label: params.label,
      value: params.value,
      transport: "beacon",
    });
  } catch (error) {
    sentryCaptureException(error, { extra: { action, params } });
  }
}
