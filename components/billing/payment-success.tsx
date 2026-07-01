'use client';

import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface PaymentSuccessProps {
  planName: string;
  onContinue: () => void;
}

export default function PaymentSuccess({
  planName,
  onContinue,
}: PaymentSuccessProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-12">
      <div className="rounded-full bg-green-100 p-3">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Payment Successful!
        </h2>
        <p className="text-gray-600">
          Welcome to <span className="font-semibold">{planName}</span>. You can now start using all the features.
        </p>
      </div>

      <Button
        onClick={onContinue}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}
