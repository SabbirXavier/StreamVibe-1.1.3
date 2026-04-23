import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, ChevronRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { authApi } from '../lib/api';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await authApi.login({ email, password });
      localStorage.setItem('nativeToken', token);
      window.location.href = '/admindashboard';
    } catch (error: any) {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="glass-panel p-8 rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-black/40 backdrop-blur-3xl">
          <div className="text-center mb-10">
            <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/5 mb-6">
              <ShieldCheck className="w-10 h-10 text-purple-400" />
            </div>
            <h1 className="text-4xl font-black text-chrome tracking-tight mb-2">Admin Login</h1>
            <p className="text-neutral-500 text-sm font-medium">Platform Management Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-4">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-purple-400 transition-colors" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500/50 transition-all font-medium text-white"
                  placeholder="admin@protip.live"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-4">Access Secret</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-purple-400 transition-colors" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-purple-500/50 transition-all font-medium text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${rememberMe ? 'bg-purple-600 border-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'border-white/10 bg-white/5'}`}
                >
                  {rememberMe && <ChevronRight className="w-4 h-4 text-white" />}
                </div>
                <span className="text-xs font-bold text-neutral-400 group-hover:text-neutral-300 transition-colors">Remember me</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-4 rounded-2xl shadow-[0_10px_20px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center gap-3 group relative overflow-hidden uppercase tracking-widest text-xs"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <LogIn className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{loading ? 'Authenticating...' : 'Login to Dashboard'}</span>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest leading-loose">
              Security Notice: Unauthorized access attempts are logged and reported.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
