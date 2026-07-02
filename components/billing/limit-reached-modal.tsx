'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Lock,
  TrendingUp,
  Users,
  AlertCircle,
} from 'lucide-react';

export type LimitModalType = 'expired' | 'monthly-limit' | 'team-seats' | 'resource-limit';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LimitModalType;
  onUpgrade?: () => void;
  // Custom overrides
  customTitle?: string;
  customDescription?: string;
  customIcon?: React.ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
}

const MODAL_CONFIG: Record<LimitModalType, { icon: React.ElementType; title: string; description: string; primaryLabel: string; secondaryLabel: string }> = {
  expired: {
    icon: Lock,
    title: 'Your plan has expired',
    description:
      'Renew your subscription to continue creating customers, contracts, and more.',
    primaryLabel: 'View Plans',
    secondaryLabel: 'Maybe Later',
  },
  'monthly-limit': {
    icon: TrendingUp,
    title: "You've reached your monthly limit",
    description:
      "You've used all 50 quotations included in your Starter plan this month. Upgrade to Growth for 300/month.",
    primaryLabel: 'Upgrade Plan',
    secondaryLabel: 'Maybe Later',
  },
  'team-seats': {
    icon: Users,
    title: "You've reached your team seat limit",
    description:
      'Starter includes 2 team seats. Upgrade to Growth for up to 10.',
    primaryLabel: 'Upgrade Plan',
    secondaryLabel: 'Maybe Later',
  },
  'resource-limit': {
    icon: AlertCircle,
    title: "You've reached your limit",
    description:
      'You have reached the maximum allowed for this resource on your current plan.',
    primaryLabel: 'Upgrade Plan',
    secondaryLabel: 'Maybe Later',
  },
};

export default function LimitReachedModal({
  isOpen,
  onClose,
  type,
  onUpgrade,
  customTitle,
  customDescription,
  customIcon,
  primaryLabel,
  secondaryLabel,
}: LimitReachedModalProps) {
  const config = MODAL_CONFIG[type];
  const Icon = customIcon ? undefined : config.icon;

  const title = customTitle || config.title;
  const description = customDescription || config.description;
  const primary = primaryLabel || config.primaryLabel;
  const secondary = secondaryLabel || config.secondaryLabel;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              {customIcon || <Icon className="h-6 w-6 text-red-600" />}
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-3 flex-col-reverse sm:flex-row">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-gray-700 hover:bg-gray-100"
          >
            {secondary}
          </Button>
          <Button
            onClick={() => {
              onUpgrade?.();
              onClose();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {primary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
