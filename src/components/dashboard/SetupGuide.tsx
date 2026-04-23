import React from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Play, Copy, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle, Info, Zap, Terminal } from 'lucide-react';
import { Streamer, Widget } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  streamer: Streamer;
  widgets: Widget[];
}

export default function SetupGuide({ streamer, widgets }: Props) {
  const alertWidget = widgets.find(w => w.type === 'alert');
  const goalWidget = widgets.find(w => w.type === 'goal');

  return (
    <div className="space-y-8">
      <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 border border-black/5 dark:border-white/5">
        <div className="w-24 h-24 bg-orange-600 rounded-3xl flex items-center justify-center shrink-0 shadow-xl rotate-3 overflow-hidden border-2 border-white/20">
          {streamer.profileImage ? (
            <img src={streamer.profileImage} className="w-full h-full object-cover" alt="" />
          ) : (
            <Play size={48} className="text-white" />
          )}
        </div>
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-black dark:text-white">Connect to OBS Studio</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed font-medium">
            Boost uses <span className="text-black dark:text-white font-bold italic">Browser Sources</span> to display real-time interactive overlays. No downloads or complicated plugins required.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Step 1: Alerts */}
        <div className="glass-panel p-8 space-y-6 rounded-[2.5rem] border border-black/5 dark:border-white/5">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-600/20 text-orange-600 dark:text-orange-500 flex items-center justify-center font-black text-lg">1</div>
              <h3 className="text-xl font-black text-black dark:text-white">Live Alert Box</h3>
           </div>
           <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
             Triggers animations, confetti, and <span className="text-orange-600 dark:text-orange-500 font-black">AI Voice TTS</span> when you receive a tip.
           </p>
           
           {alertWidget ? (
             <div className="space-y-4">
                <div className="bg-black/5 dark:bg-black/20 p-5 rounded-2xl border border-black/5 dark:border-white/5 font-mono text-xs break-all text-neutral-700 dark:text-neutral-300 flex items-center justify-between gap-4">
                   <span className="truncate">{window.location.origin}/overlay/{alertWidget.id}</span>
                   <button 
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/overlay/${alertWidget.id}`); toast.success("Alert URL copied!"); }}
                    className="p-3 bg-white/50 dark:bg-black/10 hover:bg-orange-600 hover:text-white rounded-xl transition-all shrink-0"
                   >
                     <Copy size={16} />
                   </button>
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest text-neutral-600 dark:text-neutral-500">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Alert Widget is Active
                </div>
             </div>
           ) : (
             <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-600 dark:text-red-400 flex items-center gap-3 font-black">
                <AlertCircle size={16} /> No Alert widget found. Please create one.
             </div>
           )}
        </div>

        {/* Step 2: Goal */}
        <div className="glass-panel p-8 space-y-6 rounded-[2.5rem] border border-black/5 dark:border-white/5">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-600 dark:text-blue-500 flex items-center justify-center font-black text-lg">2</div>
              <h3 className="text-xl font-black text-black dark:text-white">Dynamic Goal Bar</h3>
           </div>
           <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
             Shows your progress towards a goal (e.g. New PC). Updates instantly as people support you.
           </p>
           
           {goalWidget ? (
             <div className="space-y-4">
                <div className="bg-black/5 dark:bg-black/20 p-5 rounded-2xl border border-black/5 dark:border-white/5 font-mono text-xs break-all text-neutral-700 dark:text-neutral-300 flex items-center justify-between gap-4">
                   <span className="truncate">{window.location.origin}/overlay/{goalWidget.id}</span>
                   <button 
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/overlay/${goalWidget.id}`); toast.success("Goal URL copied!"); }}
                    className="p-3 bg-white/50 dark:bg-black/10 hover:bg-blue-600 hover:text-white rounded-xl transition-all shrink-0"
                   >
                     <Copy size={16} />
                   </button>
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase font-black tracking-widest text-neutral-600 dark:text-neutral-500">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Goal Widget is Active
                </div>
             </div>
           ) : (
             <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-600 dark:text-blue-400 flex items-center gap-3 font-black">
                <Info size={16} /> No Goal widget found.
             </div>
           )}
        </div>
      </div>

      <div className="glass-panel p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5">
         <h3 className="text-2xl font-black mb-10 flex items-center gap-3 text-black dark:text-white">
           <Terminal size={24} className="text-orange-600" /> OBS Setup Configuration
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400 tracking-widest">Source Types</h4>
               <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">Right-click in OBS Sources {'->'} <span className="text-black dark:text-white font-bold">Add</span> {'->'} <span className="text-orange-600 dark:text-orange-500 font-bold">Browser</span>.</p>
            </div>
            <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400 tracking-widest">Resolution</h4>
               <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">Set Width to <span className="text-black dark:text-white font-bold font-mono">800</span> and Height to <span className="text-black dark:text-white font-bold font-mono">600</span> {'('}or 1920x1080 for full screen{')'}.</p>
            </div>
            <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase text-neutral-500 dark:text-neutral-400 tracking-widest">Audio Monitoring</h4>
               <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">Check <span className="text-black dark:text-white font-bold">"Control audio via OBS"</span> if you want to apply filters to the AI Voice.</p>
            </div>
         </div>

         <div className="mt-12 p-8 bg-orange-600/10 border border-orange-500/20 rounded-3xl flex items-start gap-6">
            <Zap className="text-orange-600 dark:text-orange-500 shrink-0 mt-1" size={32} />
            <div>
               <p className="text-sm font-black text-black dark:text-white mb-2">Verify your setup!</p>
               <p className="text-xs text-neutral-600 dark:text-neutral-400">Go to the <span className="text-black dark:text-white uppercase font-bold">Overlays</span> tab and click <span className="bg-orange-600 text-white px-2 py-1 rounded text-[10px] font-black tracking-widest">TRIGGER LIVE TEST ALERT</span>. If OBS is connected correctly, the alert will appear instantly.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
