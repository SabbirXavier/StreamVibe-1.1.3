import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
import confetti from 'canvas-confetti';
import { Donation, Widget } from '../types';
import axios from 'axios';
import { socket } from '../lib/socket';
import { InteractableElement } from '../components/overlays/InteractableElement';
import { AlertWidget } from '../components/overlays/AlertWidget';

export default function OverlayPage() {
  const { widgetId } = useParams();
  const [widget, setWidget] = useState<Widget | null>(null);
  const [currentAlert, setCurrentAlert] = useState<{ donation: Donation, audioUrl: string | null } | null>(null);
  const [queue, setQueue] = useState<{ donation: Donation, audioUrl: string | null }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Widget States
  const [goalTotal, setGoalTotal] = useState(0);
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // 1. Fetch Initial Config & Status
  useEffect(() => {
    if (!widgetId) return;
    const fetchWidget = async () => {
      try {
        const res = await axios.get(`/api/public/widgets/${widgetId}`);
        setWidget(res.data);
        fetchStatus(res.data);
      } catch (err) {
        console.error("Widget fetch failed:", err);
      }
    };

    fetchWidget();
  }, [widgetId]);

  const fetchStatus = async (currentWidget: Widget) => {
    if (currentWidget.type === 'alert') return;
    try {
      const res = await axios.get(`/api/public/overlays/${widgetId}/donations`);
      const allDonations = res.data as Donation[];
      
      if (currentWidget.type === 'goal') {
        const startDate = currentWidget.config.goalStartDate ? new Date(currentWidget.config.goalStartDate).getTime() : 0;
        const relevant = allDonations.filter(d => new Date(d.createdAt).getTime() >= startDate);
        setGoalTotal(relevant.reduce((acc, d) => acc + (d.amount || 0), 0));
      } else if (currentWidget.type === 'ticker') {
         // Get the absolute highest donations? The spec says "Recent-5 Sliding Ticker with Notes"
         // So we sort by DATE descending to get the newest, not highest
         const topRecents = [...allDonations].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
         setRecentDonations(topRecents);
      } else if (currentWidget.type === 'toptipper') {
         // Get exactly 1 top tipper
         const topTipper = [...allDonations].sort((a, b) => (b.originalAmount || b.amount) - (a.originalAmount || a.amount))[0];
         if (topTipper) setRecentDonations([topTipper]);
      }
    } catch (err) {}
  }

  // 2. Connect via Sockets for Real-time
  useEffect(() => {
    if (!widgetId) return;
    socket.connect();
    socket.emit('join-widget', widgetId);

    const onAlert = (payload: { alertId: string, donation: Donation, audioUrl: string | null }) => {
      setQueue(prev => [...prev, payload]);
      // Also silently add to status lists to avoid polling
      if (widget?.type === 'goal') {
         setGoalTotal(prev => prev + payload.donation.amount);
      }
      if (widget?.type === 'ticker') {
         setRecentDonations(prev => [payload.donation, ...prev].slice(0, 5));
      }
      if (widget?.type === 'toptipper') {
         setRecentDonations(prev => {
            const currentAmount = payload.donation.originalAmount || payload.donation.amount;
            const prevAmount = prev[0] ? (prev[0].originalAmount || prev[0].amount) : 0;
            const isHigher = !prev[0] || currentAmount > prevAmount;
            return isHigher ? [payload.donation] : prev;
         });
      }
    };

    const onConfigUpdate = () => {
      // Re-fetch config if someone edits it live in dashboard
      axios.get(`/api/public/widgets/${widgetId}`).then(res => setWidget(res.data));
    }

    socket.on('overlay_alert_enqueue', onAlert);
    socket.on('widget_update', onConfigUpdate);

    return () => {
      socket.off('overlay_alert_enqueue', onAlert);
      socket.off('widget_update', onConfigUpdate);
      socket.disconnect();
    };
  }, [widgetId, widget?.type]);

  // 3. Process Queue (Alerts)
  useEffect(() => {
    if (queue.length > 0 && !isProcessing && !widget?.config.isPaused) {
      processNextAlert();
    }
  }, [queue, isProcessing, widget?.config.isPaused]);

  const processNextAlert = async () => {
    setIsProcessing(true);
    const nextAlert = queue[0];
    setQueue(prev => prev.slice(1));
    setCurrentAlert(nextAlert);

    // Confetti
    if (typeof window !== 'undefined') {
       confetti({
         particleCount: 150,
         spread: 70,
         origin: { y: 0.6 },
         colors: [widget?.config.primaryColor || '#00FFFF', '#7C3AED']
       });
    }

    if (nextAlert.audioUrl) {
       try {
         if (audioRef.current) {
           audioRef.current.src = nextAlert.audioUrl;
           audioRef.current.crossOrigin = "anonymous";
           
           await new Promise((resolve) => {
              if (!audioRef.current) return resolve(null);
              audioRef.current.onended = resolve;
              audioRef.current.onerror = (e) => {
                 console.error("Audio error", e);
                 resolve(null);
              };
              audioRef.current.play().catch(err => {
                 console.error("Playback prevented by browser", err);
                 resolve(null);
              });
           });
           await new Promise(r => setTimeout(r, 1000));
         }
       } catch (e) {
         await new Promise(r => setTimeout(r, 3000));
       }
    } else {
       await new Promise(resolve => setTimeout(resolve, (widget?.config.duration || 5) * 1000));
    }

    setCurrentAlert(null);
    setIsProcessing(false);
  };

  const isEditMode = new URLSearchParams(window.location.search).get('edit') === 'true';

  const updatePosition = async (elementId: string, data: any) => {
    if (!widget || !isEditMode) return;
    
    const newPositions = { 
       ...(widget.config.elementPositions || {}), 
       [elementId]: data 
    };
    
    // Optimistic update for UI smoothness
    setWidget({ 
       ...widget, 
       config: { ...widget.config, elementPositions: newPositions } 
    });

    try {
      await axios.patch(`/api/public/widgets/${widgetId}/positions`, {
        elementPositions: newPositions
      });
    } catch (err) {
      console.error("Position save failed:", err);
    }
  };

  if (!widget) return null;
  
  const positions = widget.config.elementPositions || {};

  // Render logic based on type
  const paddingTop = widget.config.paddingTop !== undefined ? widget.config.paddingTop : (widget.config.padding || 16);
  const paddingRight = widget.config.paddingRight !== undefined ? widget.config.paddingRight : (widget.config.padding || 16);
  const paddingBottom = widget.config.paddingBottom !== undefined ? widget.config.paddingBottom : (widget.config.padding || 16);
  const paddingLeft = widget.config.paddingLeft !== undefined ? widget.config.paddingLeft : (widget.config.padding || 16);
  const paddingStr = `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`;

  const widthStr = widget.config.width ? `${widget.config.width}px` : 'auto';
  const heightStr = widget.config.height ? `${widget.config.height}px` : 'auto';
  const hexToRgba = (hex: string, opacity: number) => {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length== 3){
        c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+opacity+')';
    }
    return hex;
  }

  const boxBg = widget.config.hideBackground 
    ? { background: 'transparent', border: 'none', boxShadow: 'none', backdropFilter: 'none' }
    : widget.config.boxGradient 
      ? { background: widget.config.boxGradient } 
      : { 
          backgroundColor: hexToRgba(widget.config.backgroundColor || '#000000', (widget.config.backgroundOpacity !== undefined ? widget.config.backgroundOpacity : 80) / 100),
          backdropFilter: 'blur(30px)'
        };
  
  return (
    <>
      <style>{`
        body, html, #root { background: transparent !important; overflow: hidden; padding: 0; margin: 0; }
        .text-chrome {
          background: linear-gradient(135deg, #fff 0%, #a1a1aa 50%, #fff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
      
      <div className="w-screen h-screen relative overflow-hidden flex items-center justify-center">
        <audio ref={audioRef} className="hidden" referrerPolicy="no-referrer" />
        
        {/* --- ALERT WIDGET --- */}
        <AnimatePresence>
          {widget.type === 'alert' && currentAlert && (
            <motion.div
              initial={{ opacity: 0, y: -100, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, y: -50, transition: { duration: 0.2 } }}
              style={{ position: 'relative' }}
            >
               <AlertWidget 
                  config={widget.config}
                  donation={currentAlert.donation}
                  isEditMode={isEditMode}
                  onUpdate={updatePosition}
                  boxBg={boxBg}
                  widthStr={widthStr}
                  heightStr={heightStr}
                  paddingStr={paddingStr}
               />
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- RECENT TICKER --- */}
        {widget.type === 'ticker' && !widget.config.isPaused && (
          <div className="absolute inset-0" style={{ padding: paddingStr }}>
            <InteractableElement 
              id="ticker_container"
              config={widget.config}
              isEditMode={isEditMode}
              onUpdate={updatePosition}
              className="flex bg-[#0D0D14]/80 backdrop-blur-[30px] border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-20 items-center px-8" 
              style={boxBg as any}
            >
               {widget.config.stickyText && (
                  <InteractableElement 
                    id="ticker_sticky"
                    config={widget.config}
                    isEditMode={isEditMode}
                    onUpdate={updatePosition}
                    className="font-black text-chrome uppercase tracking-tighter text-4xl italic flex-shrink-0 mr-12" 
                    style={{ color: widget.config.primaryColor }}
                  >
                    {widget.config.stickyText}
                  </InteractableElement>
               )}
               <div className="h-full flex-1 flex items-center overflow-hidden relative">
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: '-100%' }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 20, 
                      ease: "linear" 
                    }}
                    className="flex items-center gap-12 whitespace-nowrap"
                  >
                    {recentDonations.map((donation, idx) => (
                      <div key={donation.id || idx} className="flex items-center gap-4">
                        <span className="font-bold text-zinc-500 uppercase tracking-widest text-[10px]">
                          {widget.config.tickerLabel || 'RECENT'}
                        </span>
                        <span className="font-black text-2xl text-white">
                          {donation.donorName}
                        </span>
                        <span className="font-black text-2xl" style={{ color: widget.config.primaryColor }}>
                          {donation.originalCurrency || donation.currency || '₹'}{donation.originalAmount || donation.amount}
                        </span>
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                      </div>
                    ))}
                    {recentDonations.length === 0 && (
                      <span className="text-zinc-500 italic text-sm">Waiting for new contributions...</span>
                    )}
                  </motion.div>
               </div>
            </InteractableElement>
          </div>
        )}

        {/* --- 1 TOP TIPPER WIDGET --- */}
        {widget.type === 'toptipper' && !widget.config.isPaused && recentDonations[0] && (
           <div className="absolute inset-0" style={{ padding: paddingStr }}>
              <InteractableElement 
                id="top_tipper_container"
                config={widget.config}
                isEditMode={isEditMode}
                onUpdate={updatePosition}
                className="bg-[#0D0D14]/80 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl p-4 flex items-center gap-4 min-w-[300px]"
                style={boxBg as any}
              >
                 <InteractableElement
                   id="top_tipper_rank"
                   config={widget.config}
                   isEditMode={isEditMode}
                   onUpdate={updatePosition}
                   className="w-10 h-10 rounded-full flex items-center justify-center text-black font-black text-sm shadow-[0_0_20px_rgba(255,215,0,0.3)]" 
                   style={{ background: widget.config.primaryColor }}
                 >
                   1
                 </InteractableElement>
                 <InteractableElement
                   id="top_tipper_info"
                   config={widget.config}
                   isEditMode={isEditMode}
                   onUpdate={updatePosition}
                   className="flex flex-col"
                 >
                   <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-black mb-0.5">KING OF THE STREAM</span>
                    <div className="flex items-baseline gap-2">
                       <span className="text-2xl font-black text-chrome" style={{ filter: `drop-shadow(0 0 5px ${widget.config.primaryColor}80)` }}>{recentDonations[0].donorName}</span>
                       <span className="text-sm font-black italic" style={{ color: widget.config.primaryColor }}>
                          {recentDonations[0].originalCurrency || recentDonations[0].currency || '₹'}{recentDonations[0].originalAmount || recentDonations[0].amount}
                       </span>
                    </div>
                 </InteractableElement>
              </InteractableElement>
           </div>
        )}

        {/* --- GOAL BAR --- */}
        {widget.type === 'goal' && !widget.config.isPaused && (
           <div className="absolute inset-0" style={{ padding: paddingStr }}>
              <InteractableElement
                id="goal_container"
                config={widget.config}
                isEditMode={isEditMode}
                onUpdate={updatePosition}
                className="backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] p-8 min-w-[400px]"
                style={boxBg as any}
              >
                 <div className="flex justify-between items-end mb-4 gap-4 px-2">
                    <InteractableElement 
                      id="goal_text"
                      config={widget.config}
                      isEditMode={isEditMode}
                      onUpdate={updatePosition}
                      className="flex flex-col gap-1 overflow-hidden flex-1"
                    >
                       <span className="text-white font-black uppercase tracking-tighter text-2xl drop-shadow-lg truncate leading-tight italic">
                         {widget.config.goalTitle || 'DONATION GOAL'}
                       </span>
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] leading-none">
                         Support the channel
                       </span>
                    </InteractableElement>
                    <InteractableElement 
                      id="goal_percent"
                      config={widget.config}
                      isEditMode={isEditMode}
                      onUpdate={updatePosition}
                      className="flex flex-col items-end gap-1"
                    >
                       <span className="font-black text-4xl italic leading-none" style={{ color: widget.config.primaryColor }}>
                         {Math.min(100, Math.round(((goalTotal + (widget.config.goalStartingAmount || 0)) / (widget.config.goalAmount || 1000)) * 100))}%
                       </span>
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Complete</span>
                    </InteractableElement>
                 </div>

                 <InteractableElement 
                   id="goal_bar"
                   config={widget.config}
                   isEditMode={isEditMode}
                   onUpdate={updatePosition}
                   className="w-full bg-black/40 rounded-2xl overflow-hidden border border-white/5 h-10 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                 >
                    <div style={{ height: `${widget.config.progressBarHeight || 32}px`, position: 'relative' }}>
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${Math.min(100, Math.round(((goalTotal + (widget.config.goalStartingAmount || 0)) / (widget.config.goalAmount || 1000)) * 100))}%` }}
                         transition={{ duration: 1.5, type: 'spring', bounce: 0.1 }}
                         className="h-full relative overflow-hidden flex items-center justify-center transition-all"
                         style={{ 
                            background: widget.config.boxGradient || widget.config.primaryColor,
                            boxShadow: `inset -10px 0 20px rgba(0,0,0,0.2), 0 0 30px ${widget.config.primaryColor}30`
                         }}
                       >
                         {/* Animated Shimmer Patterns */}
                         <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] w-[200%] -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.3),transparent_70%)] pointer-events-none" />
                         <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)] animate-pulse" />
                         
                         {/* Liquid Wave Effect */}
                         <motion.div 
                            animate={{ x: [-100, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                            className="absolute inset-0 opacity-20 pointer-events-none w-[200%] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
                         />
                         
                         {/* Progress Text - Only visible in bar if wide enough */}
                         <span className="relative z-10 text-[10px] font-black text-black/60 uppercase tracking-widest px-4 truncate">
                            ₹{goalTotal + (widget.config.goalStartingAmount || 0)} / ₹{widget.config.goalAmount || 1000}
                         </span>
                       </motion.div>
                       
                       {/* Center Text Label (always visible) */}
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
                            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
                              ₹{goalTotal + (widget.config.goalStartingAmount || 0)} / ₹{widget.config.goalAmount || 1000}
                            </span>
                          </div>
                       </div>
                    </div>
                 </InteractableElement>
              </InteractableElement>
           </div>
        )}
      </div>
    </>
  );
}
