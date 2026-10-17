export const FREE_VEHICLE_LIMIT = 2;

const PREMIUM_STATUSES = new Set(['authorized', 'active']);

export function hasPremiumAccess(subscription) {
  if (!subscription || subscription.plan !== 'premium' || !PREMIUM_STATUSES.has(subscription.status)) {
    return false;
  }

  return !subscription.current_period_end || new Date(subscription.current_period_end) > new Date();
}

export function accountEntitlements(subscription, vehicleCount) {
  const isPremium = hasPremiumAccess(subscription);
  return {
    plan: isPremium ? 'premium' : 'free',
    subscriptionStatus: subscription?.status || 'free',
    isPremium,
    canUseAi: isPremium,
    vehicleLimit: isPremium ? null : FREE_VEHICLE_LIMIT,
    vehicleCount,
    canAddVehicle: isPremium || vehicleCount < FREE_VEHICLE_LIMIT
  };
}

