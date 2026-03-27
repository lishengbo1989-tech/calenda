import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ItineraryItem, TravelModule, MODULE_TYPES } from '../types';
import { cn, timeToMinutes, minutesToTime } from '../lib/utils';
import { X, GripVertical } from 'lucide-react';

interface DraggableItineraryItemProps {
  item: ItineraryItem & { module: TravelModule };
  onRemove?: (id: string) => void;
  onEdit?: (module: TravelModule) => void;
  onUpdate?: (id: string, updates: Partial<ItineraryItem>) => void;
  pixelsPerHour?: number;
}

const GRID_START_MINUTES = 7 * 60;

export const DraggableItineraryItem: React.FC<DraggableItineraryItemProps> = ({ 
  item, 
  onRemove, 
  onEdit,
  onUpdate,
  pixelsPerHour = 64
}) => {
  const PIXELS_PER_MINUTE = pixelsPerHour / 60;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item-${item.id}`,
    data: {
      type: 'itinerary-item',
      item,
    },
  });

  const [isResizing, setIsResizing] = useState<'top' | 'bottom' | null>(null);
  const [localDuration, setLocalDuration] = useState(item.duration);
  const [localStartTime, setLocalStartTime] = useState(item.startTime);

  useEffect(() => {
    if (!isResizing) {
      setLocalDuration(item.duration);
      setLocalStartTime(item.startTime);
    }
  }, [item.duration, item.startTime, isResizing]);

  // Improved resize handlers
  const onResizeMouseDown = (e: React.MouseEvent, type: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const initialDuration = item.duration;
    const initialStartTimeMinutes = timeToMinutes(item.startTime);
    
    let currentDuration = initialDuration;
    let currentStartTime = item.startTime;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE / 15) * 15;

      if (type === 'bottom') {
        currentDuration = Math.max(15, initialDuration + deltaMinutes);
        setLocalDuration(currentDuration);
      } else {
        const newStartTimeMinutes = initialStartTimeMinutes + deltaMinutes;
        const newDuration = Math.max(15, initialDuration - deltaMinutes);
        
        if (newStartTimeMinutes >= GRID_START_MINUTES) {
          currentStartTime = minutesToTime(newStartTimeMinutes);
          currentDuration = newDuration;
          setLocalStartTime(currentStartTime);
          setLocalDuration(currentDuration);
        }
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setIsResizing(null);
      onUpdate?.(item.id, {
        duration: currentDuration,
        startTime: currentStartTime
      });
    };

    setIsResizing(type);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const top = (timeToMinutes(localStartTime) - GRID_START_MINUTES) * PIXELS_PER_MINUTE;
  const height = localDuration * PIXELS_PER_MINUTE;

  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    position: 'absolute',
    left: '4px',
    right: '4px',
    zIndex: isDragging ? 50 : 10,
    backgroundColor: item.module.color || undefined,
    ...(transform ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded p-1 text-[10px] leading-tight border overflow-hidden group transition-shadow",
        !item.module.color && MODULE_TYPES[item.module.type].color,
        isDragging ? "opacity-50 shadow-2xl scale-105" : "opacity-100 shadow-sm hover:shadow-md",
        isResizing && "ring-2 ring-blue-400 z-20"
      )}
    >
      {/* Top Resize Handle */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-black/10 z-20"
        onMouseDown={(e) => onResizeMouseDown(e, 'top')}
      />

      <div className="flex justify-between items-start h-full relative">
        <div 
          {...listeners} 
          {...attributes} 
          className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-black/5 rounded shrink-0"
        >
          <GripVertical className="w-3 h-3 opacity-30" />
        </div>
        
        <div 
          className="flex-1 min-w-0 px-1 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(item.module);
          }}
        >
          <div className="font-bold truncate">{item.module.title}</div>
          <div className="opacity-70 truncate">{item.module.location}</div>
          {localDuration >= 45 && (
            <div className="mt-1 font-mono opacity-50">{localStartTime} - {minutesToTime(timeToMinutes(localStartTime) + localDuration)}</div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(item.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-black/10 rounded shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Bottom Resize Handle */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-black/10 z-20"
        onMouseDown={(e) => onResizeMouseDown(e, 'bottom')}
      />
    </div>
  );
};
