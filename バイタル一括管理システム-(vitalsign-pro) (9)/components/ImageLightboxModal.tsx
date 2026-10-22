import React from 'react';
import { X, Download, Trash2, Calendar, User, ExternalLink } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  residentName?: string;
  roomNumber?: string;
  date?: string;
  onDelete?: () => void;
  canDelete?: boolean;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  residentName,
  roomNumber,
  date,
  onDelete,
  canDelete = false
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <User size={14} className="text-blue-400" />
              <span>{residentName ? `${residentName} 様` : '入所者'}</span>
              {roomNumber && (
                <span className="text-[10px] text-slate-400 font-normal">
                  (#{roomNumber})
                </span>
              )}
            </div>
            {date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                <Calendar size={12} className="text-slate-400" />
                {date}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`vital_photo_${date || 'record'}.jpg`}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="新しいタブで開く・ダウンロード"
            >
              <Download size={17} />
            </a>
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('この添付写真を削除しますか？')) {
                    onDelete();
                    onClose();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="写真を削除"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="閉じる"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Image Display Area */}
        <div className="bg-slate-950 flex items-center justify-center p-3 sm:p-6 overflow-auto flex-1 min-h-[250px] max-h-[70vh]">
          <img 
            src={imageUrl} 
            alt="添付写真プレビュー" 
            className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-md"
          />
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">
            ※ 写真は長辺最大1024pxに自動最適化・圧縮されています
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer text-xs"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
