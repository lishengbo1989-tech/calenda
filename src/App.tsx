import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragEndEvent,
  DragStartEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { format, addDays, startOfToday, parseISO } from 'date-fns';
import { 
  Plus, 
  Minus,
  Edit2,
  Sparkles, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Download,
  Trash2,
  X,
  Maximize2,
  Search,
  Filter,
  ArrowLeft,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

import { TravelModule, ItineraryItem, DayPlan, MODULE_TYPES } from './types';
import { DraggableModule } from './components/DraggableModule';
import { ItineraryCell } from './components/ItineraryCell';
import { DraggableItineraryItem } from './components/DraggableItineraryItem';
import { generateDayTheme, generateTripTheme } from './lib/gemini';
import { cn } from './lib/utils';

const INITIAL_MODULES: TravelModule[] = [
  { id: '1', title: '酒店早餐', duration: 60, type: 'food', description: '开启元气满满的一天。', tags: ['美食', '日常'] },
  { id: '2', title: '新干线特快', duration: 120, type: 'transport', description: '前往下一个城市的快速列车。', location: '新大阪站', tags: ['交通', '长途'] },
  { id: '3', title: '博物馆参观', duration: 180, type: 'activity', description: '探索当地艺术与历史。', location: '市中心', tags: ['文化', '室内'] },
  { id: '4', title: '当地拉面店', duration: 45, type: 'food', description: '快速又美味的午餐。', location: '市场区', tags: ['美食', '快餐'] },
  { id: '5', title: '酒店入住', duration: 30, type: 'hotel', description: '放下行李稍作休息。', tags: ['住宿'] },
  { id: '6', title: '晚间温泉', duration: 90, type: 'activity', description: '在温泉中放松身心。', location: '山边', tags: ['放松', '体验'] },
  { id: '7', title: '晚餐与小酌', duration: 150, type: 'food', description: '社交并享用当地美食。', tags: ['美食', '夜生活'] },
];

const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const hour = i + 7;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export default function App() {
  const [modules, setModules] = useState<TravelModule[]>(INITIAL_MODULES);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [days, setDays] = useState<DayPlan[]>(
    Array.from({ length: 5 }, (_, i) => ({
      date: addDays(startOfToday(), i),
      location: i === 0 ? '大阪' : i < 3 ? '津和野' : '直岛',
    }))
  );
  const [tripTheme, setTripTheme] = useState<string>('我的宏伟冒险');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New states for filtering and editing
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<TravelModule | null>(null);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [tempLocation, setTempLocation] = useState('');
  const [pendingPlacement, setPendingPlacement] = useState<{ dayIndex: number, time: string } | null>(null);
  const [globalDestination, setGlobalDestination] = useState('');
  const [isLibraryFullView, setIsLibraryFullView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('trip_itinerary');
    if (saved) {
      try {
        const { days: savedDays, itinerary: savedItinerary, tripTheme: savedTheme } = JSON.parse(saved);
        setDays(savedDays.map((d: any) => ({ ...d, date: parseISO(d.date) })));
        setItinerary(savedItinerary);
        setTripTheme(savedTheme);
      } catch (e) {
        console.error('Failed to load saved itinerary', e);
      }
    }
  }, []);

  const handleSave = () => {
    const data = {
      days,
      itinerary,
      tripTheme
    };
    localStorage.setItem('trip_itinerary', JSON.stringify(data));
    toast.success('行程已成功保存到本地');
  };

  const handleExport = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: '正在准备 PDF...',
        success: () => {
          window.print();
          return 'PDF 已准备就绪';
        },
        error: '导出失败',
      }
    );
  };

  // Scale states
  const [rowHeight, setRowHeight] = useState(64); // default h-16
  const [columnWidth, setColumnWidth] = useState(200); // min-width for day columns

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const allTags = Array.from(new Set(modules.flatMap(m => m.tags)));

  const filteredModules = modules.filter(m => {
    const matchesType = !selectedType || m.type === selectedType;
    const matchesTag = !selectedTag || m.tags.includes(selectedTag);
    const matchesSearch = !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesTag && matchesSearch;
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);

    if (over && over.id.toString().startsWith('cell-')) {
      const [, dayIndexStr, time] = over.id.toString().split('-');
      const dayIndex = parseInt(dayIndexStr);
      
      const activeData = active.data.current;

      if (activeData?.type === 'module') {
        // New item from sidebar
        const module = activeData.module as TravelModule;
        const newItem: ItineraryItem = {
          id: Math.random().toString(36).substr(2, 9),
          moduleId: module.id,
          dayIndex,
          startTime: time,
          duration: module.duration,
        };

        setItinerary(prev => {
          const filtered = prev.filter(item => !(item.dayIndex === dayIndex && item.startTime === time));
          return [...filtered, newItem];
        });
      } else if (activeData?.type === 'itinerary-item') {
        // Moving existing item
        const existingItem = activeData.item as ItineraryItem;
        
        setItinerary(prev => {
          // Remove from old position and potential collision at new position
          const filtered = prev.filter(item => 
            item.id !== existingItem.id && 
            !(item.dayIndex === dayIndex && item.startTime === time)
          );
          
          return [...filtered, {
            ...existingItem,
            dayIndex,
            startTime: time
          }];
        });
      }
    }
  };

  const handleGlobalLocationChange = (val: string) => {
    setGlobalDestination(val);
    setDays(prev => prev.map(day => ({ ...day, location: val })));
  };

  const handleStartDateChange = (dateStr: string) => {
    const newDate = new Date(dateStr);
    if (isNaN(newDate.getTime())) return;
    setDays(prev => prev.map((day, i) => ({
      ...day,
      date: addDays(newDate, i)
    })));
  };

  const handleDurationChange = (newCount: number) => {
    if (newCount < 1 || newCount > 14) return;
    setDays(prev => {
      if (newCount > prev.length) {
        const lastDay = prev[prev.length - 1];
        const newDays = [...prev];
        for (let i = prev.length; i < newCount; i++) {
          newDays.push({
            date: addDays(lastDay.date, i - prev.length + 1),
            location: lastDay.location,
            theme: '规划中...',
          });
        }
        return newDays;
      } else {
        return prev.slice(0, newCount);
      }
    });
  };

  const handleLocationUpdate = (index: number) => {
    if (!tempLocation.trim()) {
      setEditingLocationIndex(null);
      return;
    }
    setDays(prev => prev.map((day, i) => i === index ? { ...day, location: tempLocation } : day));
    setEditingLocationIndex(null);
  };

  const removeItem = (id: string) => {
    setItinerary(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ItineraryItem>) => {
    setItinerary(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleCellClick = (dayIndex: number, time: string) => {
    setPendingPlacement({ dayIndex, time });
    setIsAddingModule(true);
  };

  const activeModule = activeId ? modules.find(m => `module-${m.id}` === activeId) : null;

  return (
    <>
    <AnimatePresence mode="wait">
      {isLibraryFullView ? (
        <motion.div 
          key="library-full"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-white text-[#1A1A1A] font-sans"
        >
        <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-50">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsLibraryFullView(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-serif italic font-light">素材库管理</h1>
              <p className="text-xs text-gray-400 font-mono uppercase tracking-widest mt-1">管理、筛选与编辑你的旅行素材</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="搜索素材..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsAddingModule(true)}
              className="px-6 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> 新建素材
            </button>
          </div>
        </header>

        <main className="px-8 py-8">
          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <div className="w-64 shrink-0 space-y-8">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <Filter className="w-3 h-3" /> 类别筛选
                </h3>
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedType(null)}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl text-sm font-medium text-left transition-all",
                      !selectedType ? "bg-orange-50 text-orange-600" : "hover:bg-gray-50 text-gray-500"
                    )}
                  >
                    全部素材
                  </button>
                  {Object.entries(MODULE_TYPES).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedType(key === selectedType ? null : key)}
                      className={cn(
                        "w-full px-4 py-2 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between",
                        selectedType === key ? "bg-orange-50 text-orange-600" : "hover:bg-gray-50 text-gray-500"
                      )}
                    >
                      <span>{value.label}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-md">
                        {modules.filter(m => m.type === key).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> 热门标签
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                        selectedTag === tag ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid View */}
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredModules.map(module => (
                  <div 
                    key={module.id}
                    className="group bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-xl hover:border-orange-200 transition-all cursor-pointer relative overflow-hidden"
                    onClick={() => setEditingModule(module)}
                  >
                    <div className={cn(
                      "absolute top-0 left-0 w-1 h-full",
                      MODULE_TYPES[module.type as keyof typeof MODULE_TYPES]?.color || "bg-gray-400"
                    )} />
                    <div className="flex justify-between items-start mb-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        MODULE_TYPES[module.type as keyof typeof MODULE_TYPES]?.color.replace('bg-', 'text-').replace('600', '700') || "text-gray-500",
                        MODULE_TYPES[module.type as keyof typeof MODULE_TYPES]?.color.replace('bg-', 'bg-').replace('600', '50') || "bg-gray-50"
                      )}>
                        {MODULE_TYPES[module.type as keyof typeof MODULE_TYPES]?.label}
                      </span>
                      <div className="flex items-center gap-1 text-gray-400 text-xs font-mono">
                        <Clock className="w-3 h-3" />
                        {module.duration} min
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-orange-600 transition-colors">{module.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">{module.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {module.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">#{tag}</span>
                      ))}
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 className="w-4 h-4 text-orange-400" />
                    </div>
                  </div>
                ))}
              </div>
              {filteredModules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400">
                  <Search className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-serif italic">未找到匹配的素材</p>
                  <button 
                    onClick={() => {setSearchQuery(''); setSelectedTag(null); setSelectedType(null);}}
                    className="mt-4 text-orange-500 hover:underline text-sm"
                  >
                    重置所有筛选
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Reuse the existing Modals */}
        <AnimatePresence>
          {editingModule && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold font-serif italic">编辑素材</h3>
                  <button onClick={() => setEditingModule(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">名称</label>
                    <input 
                      type="text" 
                      value={editingModule.title}
                      onChange={(e) => setEditingModule({...editingModule, title: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">类型</label>
                      <select 
                        value={editingModule.type}
                        onChange={(e) => setEditingModule({...editingModule, type: e.target.value as any})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      >
                        {Object.entries(MODULE_TYPES).map(([key, value]) => (
                          <option key={key} value={key}>{value.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">时长 (分钟)</label>
                      <input 
                        type="number" 
                        value={editingModule.duration}
                        onChange={(e) => setEditingModule({...editingModule, duration: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">描述</label>
                    <textarea 
                      value={editingModule.description}
                      onChange={(e) => setEditingModule({...editingModule, description: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all h-24 resize-none"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => {
                        setModules(prev => prev.filter(m => m.id !== editingModule.id));
                        setEditingModule(null);
                      }}
                      className="px-6 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> 删除
                    </button>
                    <button 
                      onClick={() => {
                        setModules(prev => prev.map(m => m.id === editingModule.id ? editingModule : m));
                        setEditingModule(null);
                      }}
                      className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                    >
                      保存修改
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isAddingModule && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold font-serif italic">添加新素材</h3>
                  <button onClick={() => setIsAddingModule(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const newModule: TravelModule = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: formData.get('title') as string,
                    type: formData.get('type') as any,
                    duration: parseInt(formData.get('duration') as string) || 60,
                    description: formData.get('description') as string,
                    tags: (formData.get('tags') as string).split(',').map(t => t.trim()).filter(Boolean),
                  };
                  setModules(prev => [...prev, newModule]);
                  setIsAddingModule(false);
                }} className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">名称</label>
                    <input name="title" required type="text" placeholder="例如：当地拉面店" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">类型</label>
                      <select name="type" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all">
                        {Object.entries(MODULE_TYPES).map(([key, value]) => (
                          <option key={key} value={key}>{value.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">时长 (分钟)</label>
                      <input name="duration" type="number" defaultValue="60" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">标签 (逗号分隔)</label>
                    <input name="tags" type="text" placeholder="美食, 热门, 必吃" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">描述</label>
                    <textarea name="description" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all h-24 resize-none" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors pt-4">
                    确认添加
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div 
          key="main-view"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-[#F5F5F3] text-[#1A1A1A] font-sans selection:bg-orange-200"
        >
      <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
      >
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-6 sticky top-0 z-30">
          <div className="w-full flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-gray-400 mb-2">
                <CalendarIcon className="w-3 h-3" />
                <span>智能旅行日程规划工具</span>
              </div>
              <h1 className="text-4xl font-serif italic font-light tracking-tight flex items-center gap-4">
                {tripTheme}
                {isGenerating && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 text-orange-400" />
                  </motion.div>
                )}
              </h1>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" /> 导出 PDF
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-[#1A1A1A] text-white hover:bg-black transition-colors text-sm font-medium"
              >
                <Save className="w-4 h-4" /> 保存行程
              </button>
            </div>
          </div>
        </header>

        <main className="w-full px-8 py-8 grid grid-cols-[320px_1fr] gap-8">
          {/* Sidebar - Module Library */}
          <aside className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-180px)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-serif italic">素材库</h2>
                <button 
                  onClick={() => setIsLibraryFullView(true)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-all"
                  title="放大素材库"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Filter Section 1: Hard Content */}
              <div className="mb-6 shrink-0">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">硬性内容 (吃/住/行/体验)</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedType(null)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-all border",
                      !selectedType ? "bg-black text-white border-black" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    全部
                  </button>
                  {Object.entries(MODULE_TYPES).filter(([key]) => key !== 'other').map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedType(key === selectedType ? null : key)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-all border",
                        selectedType === key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Module List - Scrollable Area */}
              <div className="flex-1 overflow-y-auto pr-2 mb-6 space-y-2">
                {filteredModules.map(module => (
                  <DraggableModule 
                    key={module.id} 
                    module={module} 
                    onEdit={setEditingModule}
                  />
                ))}
                {filteredModules.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs italic">
                    没有找到匹配的素材
                  </div>
                )}
              </div>

              {/* Filter Section 2: Theme Experience (Tags) - Moved to bottom */}
              <div className="pt-6 border-t border-gray-100 shrink-0">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">主题体验 (标签)</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                      !selectedTag ? "bg-black text-white border-black" : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    全部
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                        selectedTag === tag ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    setPendingPlacement(null);
                    setIsAddingModule(true);
                  }}
                  className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-colors border border-gray-200 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> 添加新素材
                </button>
              </div>
            </div>

            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-orange-800 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI 助手
              </h3>
              <p className="text-xs text-orange-700 leading-relaxed">
                将素材拖入网格中。我会分析你的选择，并帮助你优化旅行流程。
              </p>
            </div>
          </aside>

          {/* Itinerary Grid */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Trip Configuration Bar */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-200 flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CalendarIcon className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">出发日期</div>
                  <input 
                    type="date"
                    value={format(days[0].date, 'yyyy-MM-dd')}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer text-gray-700"
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">行程天数</div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleDurationChange(days.length - 1)}
                      className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-gray-700 w-4 text-center">{days.length}</span>
                    <button 
                      onClick={() => handleDurationChange(days.length + 1)}
                      className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-500"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">目的地</div>
                  <input 
                    type="text"
                    placeholder="输入目的地..."
                    value={globalDestination}
                    onChange={(e) => handleGlobalLocationChange(e.target.value)}
                    className="text-sm font-bold bg-transparent border-none focus:ring-0 p-0 cursor-pointer text-gray-700 placeholder:text-gray-300 w-32"
                  />
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">垂直比例 (长短)</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRowHeight(prev => Math.max(32, prev - 8))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs font-mono w-6 text-center">{rowHeight}</span>
                    <button onClick={() => setRowHeight(prev => Math.min(128, prev + 8))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">水平比例 (宽窄)</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setColumnWidth(prev => Math.max(120, prev - 20))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs font-mono w-6 text-center">{columnWidth}</span>
                    <button onClick={() => setColumnWidth(prev => Math.min(400, prev + 20))} className="p-1 hover:bg-gray-200 rounded-md text-gray-500"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div style={{ minWidth: `${100 + (days.length * columnWidth)}px` }}>
                {/* Grid Header */}
                <div 
                  className="grid border-b border-gray-200"
                  style={{ gridTemplateColumns: `100px repeat(${days.length}, ${columnWidth}px)` }}
                >
                  <div className="p-4 bg-gray-50 border-r border-gray-200 flex flex-col justify-center items-center">
                    <span className="text-[10px] font-mono uppercase text-gray-400">时间</span>
                  </div>
                  {days.map((day, i) => (
                    <div key={i} className="p-4 border-r border-gray-200 last:border-r-0 bg-gray-50/50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-mono uppercase text-gray-400">第 {i + 1} 天</span>
                        <MapPin className="w-3 h-3 text-gray-300" />
                      </div>
                      <div className="font-bold text-sm mb-1">{format(day.date, 'MM.dd')}</div>
                      
                      {/* Editable Location */}
                      <div 
                        className="text-xs text-gray-500 mb-2 cursor-pointer hover:text-orange-600 transition-colors flex items-center gap-1 group min-h-[1.5em]"
                        onClick={() => {
                          setEditingLocationIndex(i);
                          setTempLocation(day.location);
                        }}
                      >
                        {editingLocationIndex === i ? (
                          <input
                            autoFocus
                            value={tempLocation}
                            onChange={(e) => setTempLocation(e.target.value)}
                            onBlur={() => handleLocationUpdate(i)}
                            onKeyDown={(e) => e.key === 'Enter' && handleLocationUpdate(i)}
                            className="w-full text-xs border-none focus:ring-0 p-0 bg-transparent font-medium text-orange-600"
                          />
                        ) : (
                          <>
                            <span>{day.location}</span>
                            <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                          </>
                        )}
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={day.theme}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[11px] font-serif italic text-orange-600 leading-tight min-h-[2em]"
                        >
                          {day.theme || "规划中..."}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  ))}
                </div>

                {/* Grid Body */}
                <div 
                  className="grid"
                  style={{ gridTemplateColumns: `100px repeat(${days.length}, ${columnWidth}px)` }}
                >
                  {/* Time Column */}
                  <div className="border-r border-gray-200 bg-gray-50/30">
                    {TIME_SLOTS.map(time => (
                      <div 
                        key={time} 
                        className="border-b border-gray-100 flex items-center justify-center text-[10px] font-mono text-gray-400"
                        style={{ height: `${rowHeight}px` }}
                      >
                        {time}
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {days.map((_, dayIndex) => (
                    <div key={dayIndex} className="relative">
                      {TIME_SLOTS.map(time => (
                        <ItineraryCell 
                          key={`${dayIndex}-${time}`}
                          dayIndex={dayIndex}
                          time={time}
                          onClick={handleCellClick}
                          height={rowHeight}
                        />
                      ))}
                      
                      {/* Render items for this day as absolute children */}
                      {itinerary
                        .filter(item => item.dayIndex === dayIndex)
                        .map(item => {
                          const module = modules.find(m => m.id === item.moduleId);
                          if (!module) return null;
                          
                          return (
                            <DraggableItineraryItem 
                              key={item.id}
                              item={{ ...item, module }}
                              onRemove={removeItem}
                              onEdit={setEditingModule}
                              onUpdate={updateItem}
                              pixelsPerHour={rowHeight}
                            />
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Add Modal */}
        <AnimatePresence>
          {isAddingModule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsAddingModule(false);
                  setPendingPlacement(null);
                }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 overflow-hidden"
              >
                <button 
                  onClick={() => {
                    setIsAddingModule(false);
                    setPendingPlacement(null);
                  }}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
                <h2 className="text-2xl font-serif italic mb-6">
                  {pendingPlacement ? `在 ${pendingPlacement.time} 添加素材` : '创建新素材'}
                </h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const formData = new FormData(form);
                    const title = formData.get('title') as string;
                    if (!title) return;
                    
                    const tagsStr = formData.get('tags') as string;
                    const tags = tagsStr ? tagsStr.split(/[,，\s]+/).filter(Boolean) : [];

                    const newModule: TravelModule = {
                      id: Math.random().toString(36).substr(2, 9),
                      title,
                      duration: parseInt(formData.get('duration') as string) || 60,
                      type: formData.get('type') as any || 'activity',
                      description: '',
                      tags,
                      location: formData.get('location') as string,
                      color: formData.get('color') as string,
                    };
                    setModules(prev => [...prev, newModule]);

                    if (pendingPlacement) {
                      const newItem: ItineraryItem = {
                        id: Math.random().toString(36).substr(2, 9),
                        moduleId: newModule.id,
                        dayIndex: pendingPlacement.dayIndex,
                        startTime: pendingPlacement.time,
                        duration: newModule.duration,
                      };
                      setItinerary(prev => [...prev, newItem]);
                      setPendingPlacement(null);
                    }

                    setIsAddingModule(false);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">名称</label>
                    <input 
                      name="title"
                      placeholder="例如：筑地市场早餐"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">标签</label>
                    <input 
                      name="tags"
                      placeholder="美食, 探店, 早起 (用逗号分隔)"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">类型</label>
                      <select 
                        name="type"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all bg-white"
                      >
                        <option value="activity">体验</option>
                        <option value="food">吃</option>
                        <option value="transport">行</option>
                        <option value="hotel">住</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">时长 (分钟)</label>
                      <input 
                        name="duration"
                        type="number"
                        placeholder="60"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">体验细节</label>
                    <textarea 
                      name="location"
                      placeholder="分享关于这个体验的更多细节..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">个性化颜色</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        name="color" 
                        defaultValue="#fef3c7"
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">点击选择素材背景色</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsAddingModule(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                    >
                      创建素材
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingModule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingModule(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 overflow-hidden"
              >
                <h2 className="text-2xl font-serif italic mb-6">编辑素材详情</h2>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const formData = new FormData(form);
                    const title = formData.get('title') as string;
                    if (!title) return;

                    const tagsStr = formData.get('tags') as string;
                    const tags = tagsStr ? tagsStr.split(/[,，\s]+/).filter(Boolean) : [];

                    setModules(prev => prev.map(m => m.id === editingModule.id ? {
                      ...m,
                      title,
                      duration: parseInt(formData.get('duration') as string) || 60,
                      type: formData.get('type') as any || 'activity',
                      location: formData.get('location') as string,
                      tags,
                      color: formData.get('color') as string,
                    } : m));
                    setEditingModule(null);
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">名称</label>
                    <input 
                      name="title"
                      defaultValue={editingModule.title}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">标签</label>
                    <input 
                      name="tags"
                      defaultValue={editingModule.tags.join(', ')}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">类型</label>
                      <select 
                        name="type"
                        defaultValue={editingModule.type}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all bg-white"
                      >
                        <option value="activity">体验</option>
                        <option value="food">吃</option>
                        <option value="transport">行</option>
                        <option value="hotel">住</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">时长 (分钟)</label>
                      <input 
                        name="duration"
                        type="number"
                        defaultValue={editingModule.duration}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">体验细节</label>
                    <textarea 
                      name="location"
                      defaultValue={editingModule.location}
                      placeholder="分享关于这个体验的更多细节..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all resize-none h-24"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">个性化颜色</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        name="color" 
                        defaultValue={editingModule.color || '#fef3c7'}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">点击选择素材背景色</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setEditingModule(null)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                    >
                      保存修改
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeId && activeData ? (
            (() => {
              const module = activeData.type === 'module' 
                ? activeData.module 
                : activeData.type === 'itinerary-item' 
                  ? activeData.item.module 
                  : null;

              if (!module) return null;

              return (
                <div 
                  className={cn(
                    "p-3 rounded-lg border-2 shadow-xl w-[260px]",
                    !module.color && MODULE_TYPES[module.type].color
                  )}
                  style={{ backgroundColor: module.color || undefined }}
                >
                  <h4 className="text-sm font-bold leading-tight">{module.title}</h4>
                  <p className="text-xs opacity-70">{module.duration} 分钟</p>
                </div>
              );
            })()
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <footer className="w-full px-8 py-12 border-t border-gray-200 mt-12 flex justify-between items-center text-gray-400 text-xs font-mono uppercase tracking-widest">
        <span>&copy; 2026 TabiPlan Studio</span>
        <div className="flex gap-8">
          <a href="#" className="hover:text-gray-600 transition-colors">隐私政策</a>
          <a href="#" className="hover:text-gray-600 transition-colors">服务条款</a>
          <a href="#" className="hover:text-gray-600 transition-colors">支持</a>
        </div>
      </footer>
        </motion.div>
      )}
    </AnimatePresence>
    <Toaster position="top-center" expand={true} richColors />
    </>
  );
}
