/**
 * useSubscription — returns the current user's subscription state.
 *
 * isSubscribed: true if the user has an active paid subscription.
 * isLoaded:     false while Clerk is still initializing.
 * status:       raw Stripe subscription status string, or 'none'.
 */

import { useUser } from '@clerk/clerk-react';

export function useSubscription() {
  const { user, isLoaded } = useUser();

  const status = user?.publicMetadata?.subscriptionStatus || 'none';
  const isSubscribed = isLoaded && status === 'active';

  return { isSubscribed, isLoaded, status };
}
