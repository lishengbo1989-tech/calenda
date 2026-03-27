import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { ItineraryItem, TravelModule } from '../types';
import { cn } from '../lib/utils';
import { DraggableItineraryItem } from './DraggableItineraryItem';

interface ItineraryCellProps {
  dayIndex: number;
  time: string;
  onClick?: (dayIndex: number, time: string) => void;
  height?: number;
}

export const ItineraryCell: React.FC<ItineraryCellProps> = ({ dayIndex, time, onClick, height = 64 }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${dayIndex}-${time}`,
    data: {
      dayIndex,
      time,
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick?.(dayIndex, time)}
      className={cn(
        "border-b border-r border-gray-200 relative transition-colors cursor-pointer group",
        isOver ? "bg-blue-50/50" : "bg-white hover:bg-gray-50/80"
      )}
      style={{ height: `${height}px` }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
          <Plus className="w-3 h-3 text-orange-600" />
        </div>
      </div>
    </div>
  );
};
