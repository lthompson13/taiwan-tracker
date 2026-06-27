/**
 * useSubscription — returns the current user's subscription state.
 *
 * isSubscribed:   true if active paid subscription OR active trial.
 * isTrial:        true if currently in a free trial period.
 * trialDaysLeft:  number of days remaining in trial, or null.
 * isLoaded:       false while Clerk is still initializing.
 * status:         raw Stripe subscription status string, or 'none'.
 */

import { useUser } from '@clerk/clerk-react';

export function useSubscription() {
  const { user, isLoaded } = useUser();

  const status = user?.publicMetadata?.subscriptionStatus || 'none';
  const isSubscribed = isLoaded && (status === 'active' || status === 'trialing');
  const isTrial = isLoaded && status === 'trialing';

  const trialEnd = user?.publicMetadata?.trialEnd || null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return { isSubscribed, isTrial, trialDaysLeft, isLoaded, status };
}
