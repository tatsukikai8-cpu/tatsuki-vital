import React, { useState, useRef, useEffect } from 'react';
import { Facility } from '../types';
import { Building2, ChevronDown, Check, Building, ArrowLeftRight } from 'lucide-react';

interface FacilitySwitcherProps {
  facilities: Facility[];
  allowedFacilityIds: string[];
  currentFacilityId: string;
  onSelectFacility: (facilityId: string) => void;
}

export const FacilitySwitcher: React.FC<FacilitySwitcherProps> = ({
  facilities,
  allowedFacilityIds,
  currentFacilityId,
  onSelectFacility,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ユーザーがアクセス可能な施設のみを抽出
  const accessibleFacilities = facilities.filter(f => allowedFacilityIds.includes(f.id));
  const currentFacility = facilities.find(f => f.id === currentFacilityId) || accessibleFacilities[0];

  // 外側クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!currentFacility) {
    return null;
  }

  // 所属施設が1つのみの場合: 切り替えUIを隠すか非活性バッジとして表示
  if (accessibleFacilities.length <= 1) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-bold border border-blue-200"
        title="所属施設 (兼務なし)"
      >
        <Building size={13} className="shrink-0 text-blue-600" />
        <span className="truncate max-w-[180px]">{currentFacility.name}</span>
      </div>
    );
  }

  // 兼務している場合: ドロップダウン切り替えUI
  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-900 border border-blue-300/80 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm active:scale-[0.98] group"
        title="施設を切り替える"
      >
        <div className="bg-blue-600 text-white p-1 rounded-lg shrink-0 group-hover:bg-blue-700 transition-colors">
          <Building2 size={13} />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-blue-600 flex items-center gap-1">
            <ArrowLeftRight size={9} />
            施設切替
          </span>
          <span className="truncate max-w-[150px] sm:max-w-[200px] text-xs font-black mt-0.5">
            {currentFacility.name}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          className={`text-blue-500 transition-transform duration-200 ml-0.5 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div className="origin-top-left absolute left-0 mt-2 w-72 rounded-2xl shadow-2xl bg-white border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600" />
              兼務施設一覧 ({accessibleFacilities.length}施設)
            </span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
              マルチテナント
            </span>
          </div>
          <div className="p-1.5 space-y-1 max-h-72 overflow-y-auto">
            {accessibleFacilities.map((facility) => {
              const isSelected = facility.id === currentFacilityId;
              return (
                <button
                  key={facility.id}
                  type="button"
                  onClick={() => {
                    onSelectFacility(facility.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start justify-between gap-2 text-xs ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200 text-blue-900 font-bold'
                      : 'hover:bg-slate-50 text-slate-700 font-medium'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-extrabold">{facility.name}</span>
                      {isSelected && (
                        <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                          表示中
                        </span>
                      )}
                    </div>
                    {facility.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{facility.description}</p>
                    )}
                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">ID: {facility.id}</span>
                  </div>
                  {isSelected ? (
                    <Check size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <span className="w-4" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FacilitySwitcher;
