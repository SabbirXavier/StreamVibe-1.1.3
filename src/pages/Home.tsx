import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, ShieldCheck, Cpu, Volume2, Globe, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api';
import { SubscriptionCard } from '../components/SubscriptionCard';

export default function Home() {
  const [platformName, setPlatformName] = useState('ProTip');
  const navigate = useNavigate();

  useEffect(() => {
    adminApi.getSettings().then(settings => {
      if (settings?.platformName) {
        setPlatformName(settings.platformName);
      }
    }).catch(err => console.error("Could not fetch settings", err));
  }, []);

  const handleSubscribe = () => {
     navigate('/dashboard?tab=plans');
  };

  return (
    <main className="pt-32 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="px-4 text-center relative max-w-7xl mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-6 shadow-[0_0_15px_rgba(0,255,255,0.15)]">
            Premium Creator Infrastructure
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1] text-chrome">
            Streamer Tech that Treats You Like a <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00FFFF] to-[#7C3AED]">Professional.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            Zero platform fees. 100% direct tipping via UPI. Server-side AI TTS, animated overlays, and dedicated creator support powered by a simple subscription.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto">
            <Link to="/dashboard" className="w-full sm:w-auto bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white px-8 py-4 rounded-full font-bold text-lg hover:brightness-125 transition-all shadow-[0_0_30px_rgba(124,58,237,0.4)] flex items-center justify-center gap-2 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10 flex items-center gap-2">Start 14-Day Legend Trial <ArrowRight size={20} /></span>
            </Link>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="w-full mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <FeatureCard 
            icon={<Zap className="text-[#00FFFF]" size={28} />}
            title="Instant Verification"
            description="Secure server-side webhooks instantly relay verified payments via Socket.io directly to your OBS overlays without client-side delays."
          />
          <FeatureCard 
            icon={<Volume2 className="text-[#7C3AED]" size={28} />}
            title="Server-Side AI TTS"
            description="Our backend generates and caches realistic voice interactions without straining your CPU or relying on browser APIs."
          />
          <FeatureCard 
            icon={<ShieldCheck className="text-[#4F46E5]" size={28} />}
            title="Anti-Abuse Core"
            description="Strict hardware, network, and account identification stops fraud and protects legitimate creators."
          />
        </div>
      </section>
      
      {/* Subscriptions */}
      <section className="mt-32 px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-chrome">Choose Your Tier</h2>
          <p className="text-zinc-500 mt-4 max-w-xl mx-auto">100% of your tips go directly to your bank. Pay only for the infrastructure you need.</p>
        </div>
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-8">
            <SubscriptionCard 
                title="Rookie" 
                price="₹299/mo" 
                features={["Standard Cloud TTS", "Basic Static Overlays", "Banners & Profile Uploads", "Zero Translation Fees"]} 
                onSubscribe={handleSubscribe}
            />
            <SubscriptionCard 
                title="Elite" 
                price="₹599/mo" 
                originalPrice="₹899/mo"
                features={["Premium AI TTS (Realistic)", "Recent-5 Sliding Ticker with Notes", "Animated Liquid Goal Bar", "Everything in Rookie"]} 
                highlight={true}
                onSubscribe={handleSubscribe}
            />
            <SubscriptionCard 
                title="Legend" 
                price="₹999/mo" 
                originalPrice="₹1499/mo"
                features={["Celebrity AI TTS Voices", "Top Tipper Standalone Widget", "Custom CSS/JS Injection", "Priority Support & Access"]} 
                onSubscribe={handleSubscribe}
            />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel glass-card-hover rounded-[2rem] p-8 group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
         {icon}
      </div>
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-[0_0_15px_rgba(255,255,255,0.05)] text-white">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 tracking-tight text-zinc-100">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed font-medium">{description}</p>
    </div>
  );
}
