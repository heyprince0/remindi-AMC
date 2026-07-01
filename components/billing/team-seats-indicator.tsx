'use client';

import { UsageData } from '@/lib/billing-types';
import { Users } from 'lucide-react';

interface TeamSeatsIndicatorProps {
  usage: UsageData;
}

export default function TeamSeatsIndicator({ usage }: TeamSeatsIndicatorProps) {
  const isOverLimit = usage.teamSeats.used > usage.teamSeats.limit;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Team Seats</h3>
      </div>

      <div className={`rounded-lg p-4 ${isOverLimit ? 'bg-red-50' : 'bg-gray-50'}`}>
        <p className={`text-sm ${isOverLimit ? 'text-red-700' : 'text-gray-700'}`}>
          Seats Used
        </p>
        <p className={`text-3xl font-bold mt-2 ${isOverLimit ? 'text-red-600' : 'text-gray-900'}`}>
          {usage.teamSeats.used} / {usage.teamSeats.limit}
        </p>
        {isOverLimit && (
          <p className="text-sm text-red-600 mt-2 font-medium">
            You've exceeded your team seat limit
          </p>
        )}
      </div>
    </div>
  );
}
