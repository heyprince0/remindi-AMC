'use client';

import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface PaymentButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function PaymentButton({
  onClick,
  loading = false,
  disabled = false,
}: PaymentButtonProps) {
  return (
    <div className="space-y-4">
      <Button
        onClick={onClick}
        disabled={loading || disabled}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing...
          </span>
        ) : (
          'Proceed to Payment'
        )}
      </Button>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <Lock className="h-4 w-4" />
        <span>Secure payment powered by Razorpay</span>
      </div>
    </div>
  );
}
