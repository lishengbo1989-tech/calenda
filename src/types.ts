export interface TravelModule {
  id: string;
  title: string;
  description: string;
  type: 'transport' | 'food' | 'activity' | 'hotel' | 'other';
  category?: string;
  duration: number; // in minutes
  location?: string;
  color?: string;
  tags: string[];
}

export interface ItineraryItem {
  id: string;
  moduleId: string;
  dayIndex: number;
  startTime: string; // "HH:mm"
  duration: number;
}

export interface DayPlan {
  date: Date;
  location: string;
  theme?: string;
}

export const MODULE_TYPES = {
  transport: { label: '行', color: 'bg-blue-100 border-blue-300 text-blue-800' },
  food: { label: '吃', color: 'bg-orange-100 border-orange-300 text-orange-800' },
  activity: { label: '体验', color: 'bg-green-100 border-green-300 text-green-800' },
  hotel: { label: '住', color: 'bg-purple-100 border-purple-300 text-purple-800' },
  other: { label: '其他', color: 'bg-gray-100 border-gray-300 text-gray-800' },
};
