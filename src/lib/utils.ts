import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export interface LayoutSegment {
  startMinutes: number;
  endMinutes: number;
  left: number; // 0 to 1
  width: number; // 0 to 1
}

export function calculateDayLayout(items: { id: string, startTime: string, duration: number }[]) {
  if (items.length === 0) return {};

  const itemData = items.map(item => ({
    ...item,
    start: timeToMinutes(item.startTime),
    end: timeToMinutes(item.startTime) + item.duration,
  })).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  const layouts: Record<string, LayoutSegment[]> = {};
  items.forEach(item => { layouts[item.id] = []; });

  // 1. Find overlapping groups (clusters)
  const clusters: (typeof itemData)[] = [];
  let currentCluster: typeof itemData = [];
  let clusterEnd = -1;

  itemData.forEach(item => {
    if (item.start >= clusterEnd && currentCluster.length > 0) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -1;
    }
    currentCluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // 2. For each cluster, assign columns and calculate segments
  clusters.forEach(cluster => {
    const columns: (typeof itemData)[] = [];
    cluster.forEach(item => {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        if (lastInCol.end <= item.start) {
          columns[i].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
      }
    });

    // Get all unique time points within this cluster
    const clusterTimePoints = Array.from(new Set([
      ...cluster.map(i => i.start),
      ...cluster.map(i => i.end)
    ])).sort((a, b) => a - b);

    // For each interval in the cluster
    for (let i = 0; i < clusterTimePoints.length - 1; i++) {
      const start = clusterTimePoints[i];
      const end = clusterTimePoints[i + 1];
      
      // Find which columns are active in this specific interval
      const activeColIndices: number[] = [];
      columns.forEach((col, idx) => {
        if (col.some(c => c.start < end && c.end > start)) {
          activeColIndices.push(idx);
        }
      });

      const activeCount = activeColIndices.length;
      
      cluster.forEach(item => {
        if (item.start < end && item.end > start) {
          const itemColIndex = columns.findIndex(col => col.includes(item));
          const visualIndex = activeColIndices.indexOf(itemColIndex);
          
          layouts[item.id].push({
            startMinutes: start,
            endMinutes: end,
            left: visualIndex / activeCount,
            width: 1 / activeCount
          });
        }
      });
    }
  });

  return layouts;
}
