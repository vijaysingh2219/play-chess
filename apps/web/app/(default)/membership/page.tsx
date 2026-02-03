'use client';

import {
  useCancelSubscriptionMutation,
  useCreateCustomerMutation,
  useCreateSubscriptionMutation,
  useCustomerSubscription,
  useManageSubscriptionMutation,
  useRestoreSubscriptionMutation,
  useSubscription,
} from '@/hooks/subscriptions';
import { useRequiredAuthUser } from '@/hooks/use-auth-user';
import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';
import { formatDateRange } from '@workspace/utils/helpers';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  Crown,
  Loader2,
  Shield,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

// Loading skeleton component
function MembershipPageSkeleton() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <Skeleton className="mx-auto h-10 w-64" />
          <Skeleton className="mx-auto mt-3 h-6 w-96" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MembershipPage() {
  const { user } = useRequiredAuthUser();
  const userId = user?.id;
  const userName = user?.name;
  const userEmail = user?.email;
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

  const returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/membership` : '';
  const {
    data: isStripeCustomer,
    isLoading: isCustomerLoading,
    error: customerError,
  } = useCustomerSubscription(userId);

  const {
    data: subscription,
    isLoading: isSubscriptionLoading,
    error: subscriptionError,
  } = useSubscription(userId);

  const createCustomerMutation = useCreateCustomerMutation({
    userId,
    userName,
    userEmail,
    returnUrl,
  });

  // Mutation to create new subscription
  const createSubscriptionMutation = useCreateSubscriptionMutation({
    userId,
    returnUrl,
  });

  // Mutation to manage billing
  const manageBillingMutation = useManageSubscriptionMutation({
    userId,
    returnUrl,
  });

  const cancelSubscriptionMutation = useCancelSubscriptionMutation({
    userId,
    setShowCancelDialog,
    returnUrl,
  });

  // Mutation to restore subscription
  const restoreSubscriptionMutation = useRestoreSubscriptionMutation({
    userId,
    subscriptionId: subscription?.id,
  });

  // Show loading skeleton
  if (isSubscriptionLoading || isCustomerLoading) {
    return <MembershipPageSkeleton />;
  }

  // Calculate subscription status
  const subscriptionPeriodEnd = subscription?.periodEnd ? new Date(subscription.periodEnd) : null;
  const isCancelling = subscription?.cancelAtPeriodEnd || false;
  const cancelAt = subscription?.cancelAt ? new Date(subscription.cancelAt) : null;
  const canceledAt = subscription?.canceledAt ? new Date(subscription.canceledAt) : null;

  // Calculate trial status
  const trialEnd = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const isTrialing = subscription?.status === 'trialing';
  const isInTrial = isTrialing && trialEnd ? trialEnd > new Date() : false;

  // Check if trial was canceled
  const isTrialCanceled = subscription && isInTrial && cancelAt;

  // Check for errors
  const hasError = customerError || subscriptionError;

  const monthlyPrice = 1.99;
  const annualPrice = 19.99;
  const annualMonthlyEquiv = (annualPrice / 12).toFixed(2);

  const features = [
    {
      icon: <Target className="h-5 w-5" />,
      title: 'Challenge Any Player',
      description: 'Send unlimited game challenges to players of all skill levels',
    },
    {
      icon: <Crown className="h-5 w-5" />,
      title: 'Pro Badge',
      description: 'Display an exclusive Pro badge on your profile',
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: 'Early Access',
      description: 'Be the first to try new features and updates',
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Support Development',
      description: 'Help us build the best chess platform',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="bg-primary/10 mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Sparkles className="text-primary h-4 w-4" />
            <span className="text-primary text-sm font-medium">Premium Membership</span>
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
            {subscription ? (
              isTrialCanceled ? (
                'Trial Canceled'
              ) : isInTrial ? (
                'Your Free Trial'
              ) : (
                'Your Pro Membership'
              )
            ) : (
              <>
                Elevate Your <span className="text-primary">Chess Journey</span>
              </>
            )}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            {subscription ? (
              isTrialCanceled ? (
                <>Trial access ends {trialEnd && formatDateRange(trialEnd)}</>
              ) : isInTrial ? (
                <>Trial ends {trialEnd && formatDateRange(trialEnd)}</>
              ) : isCancelling ? (
                <>
                  Membership ends {subscriptionPeriodEnd && formatDateRange(subscriptionPeriodEnd)}
                </>
              ) : (
                <>
                  Renews on{' '}
                  {subscriptionPeriodEnd?.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </>
              )
            ) : (
              'Unlock premium features and support the platform you love'
            )}
          </p>
        </div>

        {/* Error Display */}
        {hasError && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {customerError
                  ? 'Failed to load customer data. Please refresh the page.'
                  : 'Failed to load subscription data. Please try again.'}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Pricing or Status */}
          <div className="lg:col-span-2">
            {subscription ? (
              // Active Subscription Card
              <Card className="border-primary/20 from-primary/5 to-primary/10 border-2 bg-gradient-to-br shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/20 rounded-full p-3">
                        <Crown className="text-primary h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">Pro Member</CardTitle>
                        <CardDescription className="mt-1">
                          {isTrialCanceled
                            ? 'Trial Canceled'
                            : isInTrial
                              ? 'Free Trial Period'
                              : 'Active Subscription'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        isTrialCanceled
                          ? 'destructive'
                          : isInTrial
                            ? 'default'
                            : isCancelling
                              ? 'destructive'
                              : 'default'
                      }
                      className="text-xs"
                    >
                      {isTrialCanceled
                        ? 'CANCELED'
                        : isInTrial
                          ? 'TRIAL'
                          : isCancelling
                            ? 'ENDING'
                            : 'ACTIVE'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status Info */}
                  <div className="space-y-4">
                    {isTrialCanceled && trialEnd && (
                      <div className="bg-destructive/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-destructive mt-0.5 h-5 w-5" />
                          <div className="flex-1">
                            <p className="text-destructive font-medium">Trial Canceled</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                              Your trial has been canceled. Access will end on{' '}
                              <span className="text-foreground font-medium">
                                {trialEnd.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </p>
                            <p className="text-destructive mt-2 text-sm font-medium">
                              {formatDateRange(trialEnd)}
                            </p>
                            {canceledAt && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Canceled on {canceledAt.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {isInTrial && !isTrialCanceled && trialEnd && (
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Calendar className="text-primary mt-0.5 h-5 w-5" />
                          <div className="flex-1">
                            <p className="font-medium">Trial Period</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                              Your trial ends on{' '}
                              <span className="text-foreground font-medium">
                                {trialEnd.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </p>
                            <p className="text-primary mt-2 text-sm font-medium">
                              {formatDateRange(trialEnd)} until billing starts
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isCancelling && !isInTrial && subscriptionPeriodEnd && (
                      <div className="bg-destructive/10 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-destructive mt-0.5 h-5 w-5" />
                          <div className="flex-1">
                            <p className="text-destructive font-medium">Subscription Ending</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                              Your Pro membership will expire on{' '}
                              <span className="text-foreground font-medium">
                                {subscriptionPeriodEnd.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </p>
                            <p className="text-destructive mt-2 text-sm font-medium">
                              {formatDateRange(subscriptionPeriodEnd)}
                            </p>
                            {canceledAt && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                Canceled on {canceledAt.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() => restoreSubscriptionMutation.mutate()}
                          disabled={restoreSubscriptionMutation.isPending}
                        >
                          {restoreSubscriptionMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Restore Membership
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!isInTrial && !isCancelling && subscriptionPeriodEnd && (
                      <div className="bg-background/50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Calendar className="text-primary mt-0.5 h-5 w-5" />
                          <div className="flex-1">
                            <p className="font-medium">Next Billing Date</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                              Your membership will automatically renew on{' '}
                              <span className="text-foreground font-medium">
                                {subscriptionPeriodEnd.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="flex-1"
                      variant="default"
                      onClick={() => manageBillingMutation.mutate()}
                      disabled={manageBillingMutation.isPending}
                    >
                      {manageBillingMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          Manage Billing
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    {!isCancelling && !isTrialCanceled && (
                      <Button
                        variant="outline"
                        onClick={() => setShowCancelDialog(true)}
                        disabled={cancelSubscriptionMutation.isPending}
                      >
                        Cancel {isInTrial ? 'Trial' : 'Membership'}
                      </Button>
                    )}
                  </div>

                  {/* Help Text */}
                  <p className="text-muted-foreground text-center text-sm">
                    {isTrialCanceled
                      ? 'Your trial has been canceled. You can reactivate it after it ends.'
                      : isInTrial
                        ? 'Cancel anytime before your trial ends to avoid charges'
                        : 'Changes and cancellations can be managed through the billing portal'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              // Pricing Cards
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Monthly Plan */}
                  <Card
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-lg',
                      selectedPlan === 'monthly'
                        ? 'border-primary border-2 shadow-md'
                        : 'border-2 border-transparent',
                    )}
                    onClick={() => setSelectedPlan('monthly')}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Monthly</CardTitle>
                        {selectedPlan === 'monthly' && (
                          <div className="bg-primary rounded-full p-1">
                            <Check className="text-primary-foreground h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">${monthlyPrice}</span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <CardDescription className="mt-2">
                        Billed monthly, cancel anytime
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  {/* Annual Plan */}
                  <Card
                    className={cn(
                      'relative cursor-pointer transition-all hover:shadow-lg',
                      selectedPlan === 'annual'
                        ? 'border-primary border-2 shadow-md'
                        : 'border-2 border-transparent',
                    )}
                    onClick={() => setSelectedPlan('annual')}
                  >
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2" variant="default">
                      Save 17%
                    </Badge>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Annual</CardTitle>
                        {selectedPlan === 'annual' && (
                          <div className="bg-primary rounded-full p-1">
                            <Check className="text-primary-foreground h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <span className="text-4xl font-bold">${annualPrice}</span>
                        <span className="text-muted-foreground">/year</span>
                      </div>
                      <CardDescription className="mt-2">
                        Just ${annualMonthlyEquiv}/month, billed annually
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>

                {/* CTA Button */}
                <Card className="border-primary/20 from-primary/5 border-2 bg-gradient-to-br to-transparent">
                  <CardContent className="p-6">
                    {!isStripeCustomer ? (
                      <Button
                        size="lg"
                        className="w-full text-lg"
                        onClick={() => createCustomerMutation.mutate()}
                        disabled={createCustomerMutation.isPending || hasError ? true : false}
                      >
                        {createCustomerMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Create Billing Account
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="w-full text-lg"
                        onClick={() =>
                          createSubscriptionMutation.mutate({ annual: selectedPlan === 'annual' })
                        }
                        disabled={createSubscriptionMutation.isPending || hasError ? true : false}
                      >
                        {createSubscriptionMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Redirecting...
                          </>
                        ) : (
                          <>
                            Upgrade to Pro
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    )}

                    <div className="text-muted-foreground mt-4 flex justify-between">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Secure payment</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Instant activation</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Right Column - Features */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="text-primary h-5 w-5" />
                  What&apos;s Included
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="bg-primary/10 text-primary mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{feature.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-destructive h-5 w-5" />
              {isInTrial ? 'Cancel Free Trial?' : 'Cancel Pro Membership?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {isInTrial
                    ? "Are you sure you want to cancel your free trial? You'll immediately lose access to these features:"
                    : "Are you sure you want to cancel your Pro membership? You'll lose access to:"}
                </p>
                <div className="bg-muted space-y-2 rounded-lg p-4">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <X className="text-destructive h-4 w-4" />
                      <span>{feature.title}</span>
                    </div>
                  ))}
                </div>
                {!isInTrial && subscriptionPeriodEnd && (
                  <p className="text-sm">
                    Your membership will remain active until{' '}
                    <span className="font-medium">
                      {subscriptionPeriodEnd.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    .
                  </p>
                )}
                {isInTrial && (
                  <p className="text-sm">
                    Your trial will be canceled immediately and you won&apos;t be charged.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSubscriptionMutation.isPending}>
              {isInTrial ? 'Keep Trial' : 'Keep Membership'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cancelSubscriptionMutation.mutate({
                  subscriptionId: subscription?.id,
                  stripeSubscriptionId: subscription?.stripeSubscriptionId,
                })
              }
              disabled={cancelSubscriptionMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {cancelSubscriptionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Yes, Cancel'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
