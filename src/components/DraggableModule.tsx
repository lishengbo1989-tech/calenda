import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { TravelModule, MODULE_TYPES } from '../types';
import { cn } from '../lib/utils';
import { GripVertical } from 'lucide-react';

interface DraggableModuleProps {
  module: TravelModule;
  onEdit?: (module: TravelModule) => void;
  selectedTags?: string[];
}

export const DraggableModule: React.FC<DraggableModuleProps> = ({ module, onEdit, selectedTags = [] }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `module-${module.id}`,
    data: {
      type: 'module',
      module,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const visibleTags = module.tags.filter(tag => selectedTags.length === 0 || selectedTags.includes(tag));

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: module.color || undefined
      }}
      className={cn(
        "p-3 mb-2 rounded-lg border-2 transition-all group relative",
        !module.color && MODULE_TYPES[module.type].color,
        isDragging ? "opacity-50 scale-95 z-50" : "opacity-100"
      )}
    >
      <div className="flex items-start gap-2">
        <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing mt-1">
          <GripVertical className="w-4 h-4 opacity-40" />
        </div>
        <div className="flex-1 min-w-0" onClick={() => onEdit?.(module)}>
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-bold leading-tight truncate cursor-pointer hover:underline">{module.title}</h4>
          </div>
          <p className="text-xs opacity-70">{module.duration} 分钟</p>
          {visibleTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {visibleTags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-white/50 text-[9px] font-medium border border-black/5">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
