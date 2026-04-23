import React from 'react';
import { Rnd } from 'react-rnd';
import { Lock, Unlock, Eye, EyeOff, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export interface InteractableProps {
  id: string;
  children: React.ReactNode;
  config: any;
  isEditMode: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onUpdate: (id: string, data: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function InteractableElement({ id, children, config, isEditMode, selectedId, onSelect, onUpdate, className, style }: InteractableProps) {
  const pos = config.elementPositions?.[id] || { x: 50, y: 50, w: 200, h: 100, locked: false, hidden: false, zIndex: 10 };
  const isSelected = selectedId === id;

  if (pos.hidden && !isEditMode) return null;

  const handleUpdate = (data: any) => {
    if (pos.locked) return;
    onUpdate(id, { 
       ...pos, 
       x: data.x, 
       y: data.y, 
       w: data.width, 
       h: data.height 
    });
  };

  const changeZIndex = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    onUpdate(id, { ...pos, zIndex: (pos.zIndex || 10) + delta });
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) onSelect(id);
  };

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(id, { ...pos, locked: !pos.locked });
  };

  const toggleHide = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(id, { ...pos, hidden: !pos.hidden });
  };

  const deleteElement = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(id, { ...pos, deleted: true });
  };

  if (pos.deleted) return null;

  return (
    <Rnd
      default={{
        x: pos.x,
        y: pos.y,
        width: pos.w || 200,
        height: pos.h || 100,
      }}
      size={{ width: pos.w || 200, height: pos.h || 100 }}
      position={{ x: pos.x, y: pos.y }}
      onDragStop={(_, d) => handleUpdate({ x: d.x, y: d.y, width: pos.w, height: pos.h })}
      onResizeStop={(_, __, ref, ___, position) => {
        handleUpdate({
          x: position.x,
          y: position.y,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
        });
      }}
      disableDragging={!isEditMode || pos.locked || !isSelected}
      enableResizing={isEditMode && !pos.locked && isSelected}
      className={`group ${className} ${isEditMode ? 'cursor-pointer' : ''} ${pos.hidden && isEditMode ? 'opacity-50' : ''}`}
      style={{ zIndex: (isEditMode ? 50 : 1) + (pos.zIndex || 10), ...style }}
      onClick={handleContainerClick}
    >
      {/* Bounding Box & Handles - Always show visual indicator if edit mode */}
      {isEditMode && (
        <div className={`absolute -inset-2 border-2 border-dashed transition-colors rounded-lg z-[60] pointer-events-none ${isSelected ? (pos.locked ? 'border-red-500' : 'border-cyan-500') : 'border-white/20'}`} />
      )}
      
      {/* Controls Overlay - Only show if selected */}
      {isEditMode && isSelected && (
        <div className="absolute -top-10 left-0 flex items-center gap-1 opacity-100 transition-opacity bg-black/80 backdrop-blur-md rounded-lg p-1 border border-white/10 z-[70] pointer-events-auto">
          <button onClick={toggleLock} className="p-1.5 hover:bg-white/10 rounded text-white transition-colors">
            {pos.locked ? <Lock size={12} className="text-red-500" /> : <Unlock size={12} className="text-cyan-500" />}
          </button>
          
          <button onClick={toggleHide} className="p-1.5 hover:bg-white/10 rounded text-white transition-colors">
            {pos.hidden ? <EyeOff size={12} className="text-zinc-500" /> : <Eye size={12} className="text-cyan-500" />}
          </button>

          <button onClick={deleteElement} className="p-1.5 hover:bg-red-900/50 rounded text-white transition-colors">
            <Trash2 size={12} className="text-red-500" />
          </button>

          <div className="w-px h-3 bg-white/10 mx-1" />
          <button onClick={(e) => changeZIndex(e, 1)} className="p-1.5 hover:bg-white/10 rounded text-white transition-colors">
            <ArrowUp size={12} className="text-cyan-500" />
          </button>
          <button onClick={(e) => changeZIndex(e, -1)} className="p-1.5 hover:bg-white/10 rounded text-white transition-colors">
            <ArrowDown size={12} className="text-cyan-500" />
          </button>

          <div className="w-px h-3 bg-white/10 mx-1" />
          <div className="text-[9px] font-black uppercase text-zinc-500 px-1">{id}</div>
        </div>
      )}

      {children}
    </Rnd>
  );
}
