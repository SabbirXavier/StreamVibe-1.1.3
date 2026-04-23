import React, { useRef, useState } from 'react';
import { Check, Sparkles, Zap, Shield, Crown, MousePointer2 } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface SubscriptionCardProps {
  key?: React.Key;
  title: string;
  price: string;
  originalPrice?: string;
  features: string[];
  highlight?: boolean;
  onSubscribe?: () => void;
  tier?: 'rookie' | 'elite' | 'legend';
  billingCycle?: 'monthly' | 'yearly';
}

export function SubscriptionCard({ title, price, originalPrice, features, highlight, onSubscribe, tier = 'rookie', billingCycle = 'monthly' }: SubscriptionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // 3D Tilt Effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const getTierConfig = () => {
    switch (tier) {
      case 'legend':
        return {
          icon: <Crown className="w-6 h-6 text-yellow-400" />,
          accent: 'from-yellow-400 via-amber-500 to-orange-600',
          glow: 'rgba(251, 191, 36, 0.3)',
          label: 'Celestial Tier',
          bg: 'bg-zinc-950/80',
          border: 'border-yellow-500/20'
        };
      case 'elite':
        return {
          icon: <Shield className="w-6 h-6 text-cyan-400" />,
          accent: 'from-cyan-400 via-blue-500 to-indigo-600',
          glow: 'rgba(34, 211, 238, 0.3)',
          label: 'Glossy Elite',
          bg: 'bg-zinc-950/80',
          border: 'border-cyan-500/20'
        };
      default:
        return {
          icon: <Zap className="w-6 h-6 text-purple-400" />,
          accent: 'from-purple-400 via-violet-500 to-fuchsia-600',
          glow: 'rgba(168, 85, 247, 0.3)',
          label: 'Technical Standard',
          bg: 'bg-zinc-950/80',
          border: 'border-white/10'
        };
    }
  };

  const config = getTierConfig();

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`relative group h-full cursor-default perspective-1000`}
    >
      {/* Background Glow Effect */}
      <motion.div 
        animate={{
          opacity: isHovered ? 1 : 0,
          scale: isHovered ? 1.1 : 0.9,
        }}
        className="absolute -inset-4 rounded-[2.5rem] blur-3xl z-0 transition-all duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at center, ${config.glow} 0%, transparent 70%)`
        }}
      />

      {/* The Main Card */}
      <div className={`relative z-10 flex flex-col h-full rounded-[2rem] ${config.bg} backdrop-blur-3xl border ${config.border} p-8 transition-all duration-500 group-hover:border-white/20 shadow-2xl`}>
        
        {/* Animated Spotlight */}
        <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
          <motion.div 
             animate={{
               top: isHovered ? (y.get() + 0.5) * 100 + '%' : '50%',
               left: isHovered ? (x.get() + 0.5) * 100 + '%' : '50%',
             }}
             className="absolute w-64 h-64 bg-white/5 blur-3xl -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
             style={{ opacity: isHovered ? 0.3 : 0 }}
          />
          {/* Animated Reflection */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        </div>

        {/* Content Section */}
        <div className="relative z-20 flex flex-col h-full">
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                 {config.icon}
                 <span className={`text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r ${config.accent} bg-clip-text text-transparent`}>
                   {config.label}
                 </span>
              </div>
              <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic line-clamp-1">{title}</h3>
            </div>
            {highlight && (
              <span className="shrink-0 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md">
                Popular
              </span>
            )}
          </div>

          <div className="mb-10">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-chrome tracking-tighter leading-tight">{price}</span>
              <span className="text-neutral-500 font-bold uppercase text-xs tracking-widest">/ {billingCycle === 'yearly' ? 'year' : 'month'}</span>
            </div>
            {originalPrice && (
              <p className="text-neutral-600 text-sm font-bold line-through ml-1 italic">{originalPrice}</p>
            )}
            {billingCycle === 'yearly' && (originalPrice || price) && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" /> Save 20% Annually
              </div>
            )}
          </div>

          <div className="flex-grow space-y-4 mb-12">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 group/feat">
                <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center bg-gradient-to-br ${config.accent} group-hover/feat:scale-110 transition-transform`}>
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-neutral-400 text-sm font-medium group-hover/feat:text-white transition-colors">{feature}</span>
              </div>
            ))}
          </div>

          <button 
            onClick={onSubscribe}
            className={`w-full relative group/btn overflow-hidden py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-xl`}
          >
            {/* Button Background */}
            <div className={`absolute inset-0 bg-gradient-to-r ${config.accent} transition-transform duration-500 group-hover/btn:scale-110`} />
            
            {/* Button Content */}
            <div className="relative z-10 flex items-center justify-center gap-3 text-white">
              <span className="group-hover/btn:translate-x-[-4px] transition-transform">Initialize Protocol</span>
              <MousePointer2 className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-[4px] transition-all" />
            </div>

            {/* Shimmer Effect */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite] pointer-events-none" />
          </button>

          <p className="mt-4 text-center text-neutral-600 text-[10px] uppercase font-black tracking-widest opacity-50">
            Secure Encrypted Transaction
          </p>
        </div>
      </div>
    </motion.div>
  );
}
