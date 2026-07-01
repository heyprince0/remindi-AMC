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
} from 'lucide-react';

export type LimitModalType = 'expired' | 'monthly-limit' | 'team-seats';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: LimitModalType;
  onUpgrade?: () => void;
}

const MODAL_CONFIG = {
  expired: {
    icon: Lock,
    title: 'Your plan has expired',
    description:
      'Renew your subscription to continue creating contracts, quotations, and invoices.',
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
};

export default function LimitReachedModal({
  isOpen,
  onClose,
  type,
  onUpgrade,
}: LimitReachedModalProps) {
  const config = MODAL_CONFIG[type];
  const Icon = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-red-100 p-3">
              <Icon className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex gap-3 flex-col-reverse sm:flex-row">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-gray-700 hover:bg-gray-100"
          >
            {config.secondaryLabel}
          </Button>
          <Button
            onClick={() => {
              onUpgrade?.();
              onClose();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {config.primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
