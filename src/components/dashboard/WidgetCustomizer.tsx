import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Palette, Play, Save, Info, AlertCircle, Volume2, Mic, Headphones, IndianRupee, Ghost, Trash2, RotateCcw } from 'lucide-react';
import { Widget } from '../../types';
import { widgetApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { AlertWidget } from '../overlays/AlertWidget';
import { InteractableElement } from '../overlays/InteractableElement';

interface ColorSystemProps {
  config: any;
  onChange: (newConfig: any) => void;
  label?: string;
}

function ColorSystem({ config, onChange, label }: ColorSystemProps) {
  const PRESET_SOLID_COLORS = ['#ea580c', '#3b82f6', '#10b981', '#ef4444', '#a855f7', '#ffffff', '#000000', 'transparent'];
  const PRESET_GRADIENTS = [
    { name: 'None (Solid/Transparent)', value: '' },
    { name: 'Sunset Warm', value: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)' },
    { name: 'Neon Cyber', value: 'linear-gradient(135deg, #13f1fc 0%, #0470dc 100%)' },
    { name: 'Deep Space', value: 'linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%)' },
    { name: 'Emerald Ocean', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
    { name: 'Candy Pink', value: 'linear-gradient(135deg, #f7ff00 0%, #db36a4 100%)' },
    { name: 'Midnight Blue', value: 'linear-gradient(135deg, #000428 0%, #004e92 100%)' },
    { name: 'Glass Ghost', value: 'rgba(255, 255, 255, 0.05)' },
  ];

  return (
    <div className="space-y-6 bg-black/40 p-6 rounded-3xl border border-white/5">
      {label && <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</label>}
      
      <div className="space-y-3">
         <p className="text-[10px] font-bold uppercase text-zinc-500">Solid / Transparent</p>
         <div className="flex flex-wrap gap-2">
            {PRESET_SOLID_COLORS.map(color => (
               <button 
                  key={color}
                  onClick={() => onChange({...config, boxGradient: null, backgroundColor: color, backgroundOpacity: color === 'transparent' ? 0 : config.backgroundOpacity})}
                  className={cn(
                    "w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center", 
                    config.backgroundColor === color && !config.boxGradient ? "border-white ring-2 ring-white/20" : "border-white/10"
                  )}
                  style={{ background: color === 'transparent' ? 'rgba(255,255,255,0.05)' : color }}
                  title={color === 'transparent' ? 'No Color (Transparent)' : color}
               >
                  {color === 'transparent' && (
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <Ghost size={12} className="text-zinc-500 animate-pulse" />
                      <span className="text-[6px] font-black uppercase text-zinc-600">None</span>
                    </div>
                  )}
               </button>
            ))}
            <input 
               type="color"
               value={config.backgroundColor || '#000000'}
               onChange={(e) => onChange({...config, boxGradient: null, backgroundColor: e.target.value})}
               className="w-9 h-9 rounded-full cursor-pointer bg-transparent border border-white/10"
            />
         </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
         <div className="flex items-center gap-3">
            <Ghost size={16} className="text-orange-500" />
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-white">Hide Background</p>
               <p className="text-[8px] text-zinc-400">Best for OBS integration</p>
            </div>
         </div>
         <button 
            onClick={() => onChange({...config, hideBackground: !config.hideBackground})}
            className={cn(
               "w-10 h-5 rounded-full relative transition-colors",
               config.hideBackground ? "bg-orange-500" : "bg-zinc-800"
            )}
         >
            <div className={cn(
               "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
               config.hideBackground ? "left-6" : "left-1"
            )} />
         </button>
      </div>

      <div className="space-y-3">
         <p className="text-[10px] font-bold uppercase text-zinc-500">Gradients</p>
         <select 
           value={config.boxGradient || ''}
           onChange={(e) => onChange({...config, boxGradient: e.target.value || null, backgroundColor: e.target.value ? null : config.backgroundColor})}
           className="cool-select w-full"
         >
           {PRESET_GRADIENTS.map((gradient, idx) => (
             <option key={idx} value={gradient.value}>{gradient.name}</option>
           ))}
         </select>
         {config.boxGradient && (
           <div className="w-full h-8 rounded-xl mt-2" style={{ background: config.boxGradient }} />
         )}
      </div>
    </div>
  );
}

interface Props {
  widget: Widget;
  onUpdate?: () => void;
  onDelete?: () => void;
  allowedTTSVoices?: string[];
  allPlatformVoices?: string[];
}

export default function WidgetCustomizer({ widget, onUpdate, onDelete, allowedTTSVoices = [], allPlatformVoices = [] }: Props) {
  const [config, setConfig] = useState(widget.config);
  const [saving, setSaving] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [testAlert, setTestAlert] = useState(false);
  const [ttsPreviewText, setTtsPreviewText] = useState('Hello! This is a preview of your Text-to-Speech alert on ProTip.');
  const [deleting, setDeleting] = useState(false);

  // Use platform voices if available, map to dropdown options
  const fallbackVoices = ['en-US', 'en-GB', 'en-AU', 'fr-FR', 'es-ES', 'ja-JP', 'hi-IN', 'celebrity-narendra-modi', 'celebrity-donald-trump', 'celebrity-elon-musk'];
  // We'll unconditionally use the full list here, or merge them.
  const voicesToDisplay = Array.from(new Set([...fallbackVoices, ...allPlatformVoices]));

  const handleSave = async () => {
    setSaving(true);
    try {
      await widgetApi.update(widget.id, config);
      toast.success("Widget settings saved!");
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save widget settings.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await widgetApi.delete(widget.id);
      toast.success("Widget removed.");
      if (onDelete) onDelete();
    } catch (err: any) {
      console.error(err);
      toast.error(`Deletion failed: ${err.message}`);
    }
    setDeleting(false);
  };

  const handleReset = () => {
    setConfig(widget.defaultConfig || {});
    toast.success("Widget reset to defaults.");
  };

  const handlePreviewVoice = async () => {
    if (previewingVoice || !config.ttsVoice) return;
    setPreviewingVoice(true);
    try {
      const response = await fetch('/api/tts/generate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: ttsPreviewText, voice: config.ttsVoice })
      });
      const data = await response.json();
      if (data.audioUrl) {
         const audio = new Audio(data.audioUrl);
         audio.onended = () => setPreviewingVoice(false);
         audio.onerror = () => setPreviewingVoice(false);
         audio.play();
      } else {
         toast.error("Preview generation failed.");
         setPreviewingVoice(false);
      }
    } catch (err) {
      toast.error("TTS request error.");
      setPreviewingVoice(false);
    }
  };

  const triggerTestAlert = () => {
    setTestAlert(true);
    setTimeout(() => setTestAlert(false), 5000);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[450px_1fr] gap-8">
      {/* Settings - Left Side for better space utilization */}
      <div className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-6 bg-black/60 h-fit max-h-[85vh] overflow-y-auto custom-scrollbar">
         <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-sm font-black uppercase tracking-tighter text-chrome">{widget.type === 'ticker' ? 'Recent Tipper' : widget.type} Configurator</h2>
            <div className="flex gap-2">
               <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 text-black px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2"
               >
                  <Save size={14} /> {saving ? '...' : 'Save'}
               </button>
               <button 
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl transition-all"
               >
                  <Trash2 size={14} />
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Master Padding (px)</label>
                <span className="text-[10px] font-mono text-cyan-400">{config.padding || 16}px</span>
              </div>
              <input 
                type="range" min="0" max="100" step="1"
                value={config.padding !== undefined ? config.padding : 16}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setConfig({ 
                    ...config, 
                    padding: val,
                    paddingTop: val,
                    paddingRight: val,
                    paddingBottom: val,
                    paddingLeft: val
                  });
                }}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            
            <div className="grid grid-cols-4 gap-2">
               {[
                 { key: 'paddingTop', label: 'Top' },
                 { key: 'paddingRight', label: 'Right' },
                 { key: 'paddingBottom', label: 'Bottom' },
                 { key: 'paddingLeft', label: 'Left' }
               ].map(side => (
                 <div key={side.key} className="space-y-1">
                    <label className="text-[8px] font-bold text-zinc-600 uppercase">{side.label}</label>
                    <input 
                      type="number" min="0" max="200" 
                      value={config[side.key] !== undefined ? config[side.key] : 16}
                      onChange={(e) => setConfig({ ...config, [side.key]: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-[10px] font-bold text-white outline-none focus:border-cyan-500"
                    />
                 </div>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Box Width</label>
              <input type="number" placeholder="Auto" value={config.width || ''} onChange={(e) => setConfig({...config, width: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] font-bold text-white focus:border-cyan-500 outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Box Height</label>
              <input type="number" placeholder="Auto" value={config.height || ''} onChange={(e) => setConfig({...config, height: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] font-bold text-white focus:border-cyan-500 outline-none" />
            </div>
         </div>

         <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Accent Color</label>
            <div className="flex items-center gap-3">
              <input 
                type="color" 
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="w-10 h-10 bg-transparent rounded-xl cursor-pointer border-0"
              />
              <span className="text-[10px] font-black font-mono uppercase text-zinc-300">{config.primaryColor}</span>
            </div>
         </div>

         {widget.type === 'alert' && (
           <div className="pt-4 border-t border-white/5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Headphones size={12} /> TTS Voice</h3>
              <div className="flex gap-2">
                 <select 
                   value={config.ttsVoice || voicesToDisplay[0]}
                   onChange={(e) => setConfig({...config, ttsVoice: e.target.value})}
                   className="grow bg-black/40 border border-white/5 rounded-xl p-3 text-xs font-bold text-white outline-none"
                 >
                   {voicesToDisplay.map(voiceId => {
                      const isAllowed = allowedTTSVoices.includes(voiceId) || allowedTTSVoices.includes('celebrity') && voiceId.startsWith('celebrity');
                      return (
                        <option key={voiceId} value={voiceId} disabled={!isAllowed}>
                          {voiceId} {!isAllowed ? '(Locked)' : ''}
                        </option>
                      );
                   })}
                 </select>
                 <button 
                  onClick={handlePreviewVoice}
                  disabled={previewingVoice}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10 flex items-center justify-center shrink-0"
                 >
                    {previewingVoice ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Play size={14} fill="currentColor" />}
                 </button>
              </div>
           </div>
         )}
         
         <div className="space-y-4 border-t border-white/5 pt-4">
            <ColorSystem 
              config={config} 
              onChange={setConfig} 
              label="Widget Appearance" 
            />
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Opacity</label>
                <span className="text-[10px] font-black text-white">{config.backgroundOpacity || 80}%</span>
              </div>
              <input 
                type="range" min="0" max="100" step="5"
                value={config.backgroundOpacity !== undefined ? config.backgroundOpacity : 80}
                onChange={(e) => setConfig({ ...config, backgroundOpacity: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
         </div>

         {widget.type === 'goal' && (
            <div className="space-y-4 border-t border-white/5 pt-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Goal Title</label>
                  <input type="text" value={config.goalTitle || ''} onChange={(e) => setConfig({ ...config, goalTitle: e.target.value })} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 outline-none font-bold text-xs text-white" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Target</label>
                     <input type="number" value={config.goalAmount} onChange={(e) => setConfig({ ...config, goalAmount: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs font-bold text-white" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Start</label>
                     <input type="number" value={config.goalStartingAmount || 0} onChange={(e) => setConfig({ ...config, goalStartingAmount: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs font-bold text-cyan-400" />
                  </div>
               </div>
            </div>
         )}

         {widget.type === 'ticker' && (
            <div className="space-y-4 border-t border-white/5 pt-4">
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Highlight Label (e.g. !PROTIP)</label>
                  <input 
                     type="text" 
                     value={config.stickyText || '!PROTIP'} 
                     onChange={(e) => setConfig({ ...config, stickyText: e.target.value })} 
                     className="w-full bg-black/40 border border-white/10 rounded-xl p-4 outline-none font-black text-lg text-chrome italic tracking-tighter" 
                  />
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Connection Label</label>
                  <input 
                     type="text" 
                     value={config.tickerLabel || ''} 
                     onChange={(e) => setConfig({ ...config, tickerLabel: e.target.value })} 
                     className="w-full bg-black/40 border border-white/5 rounded-xl p-3 outline-none font-bold text-xs text-white" 
                     placeholder="e.g. Recent Supporter"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Name limit</label>
                     <input 
                        type="number" 
                        min="5" max="30"
                        value={config.nameLimit || 12} 
                        onChange={(e) => setConfig({ ...config, nameLimit: parseInt(e.target.value) || 12 })} 
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 outline-none font-bold text-xs text-white" 
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Count</label>
                     <input 
                        type="number" 
                        min="1" max="20"
                        value={config.tickerCount || 5} 
                        onChange={(e) => setConfig({ ...config, tickerCount: parseInt(e.target.value) || 5 })} 
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 outline-none font-bold text-xs text-white" 
                     />
                  </div>
               </div>
            </div>
         )}
      </div>

      {/* Preview - Right Side, Sticky and Large */}
      <div className="lg:sticky lg:top-24 self-start space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Display Preview
           </h3>
        </div>
        
        <div className="glass-panel w-full aspect-video rounded-[3rem] border border-white/5 relative flex items-center justify-center p-12 bg-[#020205] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)]" style={{ overflow: 'hidden' }}>
          {/* Visual Canvas Background Decoration */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_#3b82f644_0%,_transparent_70%)]" />
          
          <div 
             className="relative transition-all duration-300" 
             style={{ 
                width: config.width ? `${config.width}px` : '100%',
                maxWidth: '600px',
                height: config.height ? `${config.height}px` : 'auto',
                paddingTop: `${config.paddingTop !== undefined ? config.paddingTop : 16}px`,
                paddingRight: `${config.paddingRight !== undefined ? config.paddingRight : 16}px`,
                paddingBottom: `${config.paddingBottom !== undefined ? config.paddingBottom : 16}px`,
                paddingLeft: `${config.paddingLeft !== undefined ? config.paddingLeft : 16}px`,
             }}
          >
             {widget.type === 'alert' && (
                <AlertWidget 
                  config={config}
                  donation={{donorName: 'User_XYZ', message: ttsPreviewText, amount: 500, currency: '₹'}}
                  isEditMode={true}
                  onUpdate={(id, data) => setConfig({ ...config, elementPositions: { ...(config.elementPositions || {}), [id]: data } })}
                  boxBg={ { 
                    background: config.boxGradient || config.backgroundColor || '#000000',
                    opacity: (config.backgroundOpacity !== undefined ? config.backgroundOpacity : 80) / 100,
                  } }
                  widthStr={config.width ? `${config.width}px` : '100%'}
                  heightStr={config.height ? `${config.height}px` : 'auto'}
                  paddingStr={`${config.paddingTop !== undefined ? config.paddingTop : 16}px ${config.paddingRight !== undefined ? config.paddingRight : 16}px ${config.paddingBottom !== undefined ? config.paddingBottom : 16}px ${config.paddingLeft !== undefined ? config.paddingLeft : 16}px`}
                  style={{ fontSize: `${config.alertFontSize || 16}px`, borderRadius: `${config.alertBorderRadius || 40}px` }}
                />
             )}
             
             {widget.type === 'goal' && (
                <InteractableElement
                  id="container"
                  config={config}
                  isEditMode={true}
                  onUpdate={(id, data) => setConfig({ ...config, elementPositions: { ...(config.elementPositions || {}), [id]: data } })}
                  className="w-full"
                >
                <div 
                  className="w-full flex flex-col justify-center rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
                  style={{
                     background: config.boxGradient || config.backgroundColor || '#000000',
                     opacity: (config.backgroundOpacity !== undefined ? config.backgroundOpacity : 80) / 100,
                  }}
                >
                  <div 
                     className="w-full"
                     style={{
                        paddingTop: `${config.paddingTop !== undefined ? config.paddingTop : 20}px`,
                        paddingRight: `${config.paddingRight !== undefined ? config.paddingRight : 24}px`,
                        paddingBottom: `${config.paddingBottom !== undefined ? config.paddingBottom : 20}px`,
                        paddingLeft: `${config.paddingLeft !== undefined ? config.paddingLeft : 24}px`,
                     }}
                  >
                     <div className="flex justify-between items-center mb-4 gap-4">
                       <div className="min-w-0 flex-1">
                          <p className="text-xl font-black text-white italic uppercase tracking-tighter truncate leading-tight">{config.goalTitle || 'Community Goal'}</p>
                       </div>
                       <div className="shrink-0">
                          <span className="text-3xl font-black italic tracking-tighter leading-none" style={{ color: config.primaryColor }}>
                             {Math.round((((config.goalStartingAmount || 0) + (config.currentProgress || 0)) / (config.goalAmount || 1000)) * 100)}%
                          </span>
                       </div>
                     </div>
                     
                     <div className="bg-black/50 rounded-full h-8 p-1 border border-white/5 relative overflow-hidden group">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${Math.min(100, (((config.goalStartingAmount || 0) + (config.currentProgress || 0)) / (config.goalAmount || 1000)) * 100)}%` }}
                         className="h-full rounded-full transition-all relative overflow-hidden" 
                         style={{ background: config.progressGradient || config.progressColor || config.primaryColor }} 
                       >
                          {/* Animated shimmer overlay */}
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] w-[200%] -translate-x-full animate-[shimmer_2s_infinite]" />
                       </motion.div>
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[9px] font-black text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                             ₹{(config.goalStartingAmount || 0) + (config.currentProgress || 0)} / ₹{config.goalAmount || 1000}
                          </span>
                       </div>
                     </div>
                  </div>
               </div>
               </InteractableElement>
             )}

             {/* Ticker & TopTipper remain simplified but using new padding logic */}
             {widget.type === 'ticker' && (
                <InteractableElement
                  id="container"
                  config={config}
                  isEditMode={true}
                  onUpdate={(id, data) => setConfig({ ...config, elementPositions: { ...(config.elementPositions || {}), [id]: data } })}
                  className="w-full"
                >
                <div 
                   className="w-full flex items-center justify-between rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10"
                   style={{
                      background: config.boxGradient || config.backgroundColor || '#000000',
                      opacity: (config.backgroundOpacity !== undefined ? config.backgroundOpacity : 80) / 100,
                      paddingTop: `${config.paddingTop !== undefined ? config.paddingTop : 16}px`,
                      paddingRight: `${config.paddingRight !== undefined ? config.paddingRight : 24}px`,
                      paddingBottom: `${config.paddingBottom !== undefined ? config.paddingBottom : 16}px`,
                      paddingLeft: `${config.paddingLeft !== undefined ? config.paddingLeft : 24}px`,
                   }}
                >
                  <div className="flex items-center gap-4">
                    {config.stickyText && <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">{config.stickyText}</span>}
                    <div className="flex flex-col">
                       <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">{config.tickerLabel || 'Recent Supporter'}</span>
                       <span className="text-lg font-black text-white italic uppercase tracking-tighter leading-none">User_X123</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <span className="text-xl font-black italic shadow-glow block" style={{ color: config.primaryColor }}>₹100</span>
                     <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter block">Verified</span>
                  </div>
                </div>
                </InteractableElement>
             )}

             {widget.type === 'toptipper' && (
                <InteractableElement
                  id="container"
                  config={config}
                  isEditMode={true}
                  onUpdate={(id, data) => setConfig({ ...config, elementPositions: { ...(config.elementPositions || {}), [id]: data } })}
                  className="w-full"
                >
                <div 
                   className="rounded-[3rem] border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] text-center w-full"
                   style={{
                      background: config.boxGradient || config.backgroundColor || '#0A0A0F',
                      opacity: (config.backgroundOpacity !== undefined ? config.backgroundOpacity : 80) / 100,
                   }}
                >
                   <div 
                      style={{
                         paddingTop: `${config.paddingTop !== undefined ? config.paddingTop : 24}px`,
                         paddingRight: `${config.paddingRight !== undefined ? config.paddingRight : 32}px`,
                         paddingBottom: `${config.paddingBottom !== undefined ? config.paddingBottom : 24}px`,
                         paddingLeft: `${config.paddingLeft !== undefined ? config.paddingLeft : 32}px`,
                      }}
                   >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 block" style={{ color: config.primaryColor }}>👑 Stream King</span>
                      <span className="text-4xl font-black text-chrome uppercase tracking-tighter block drop-shadow-2xl">KING_DONOR</span>
                      <span className="text-sm font-bold text-zinc-500 mt-2 block">₹10,500 Total contribution</span>
                   </div>
                </div>
                </InteractableElement>
             )}
          </div>
        </div>
      </div>
   </div>
  );

}
