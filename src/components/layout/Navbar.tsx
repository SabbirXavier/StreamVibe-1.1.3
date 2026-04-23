import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { LayoutDashboard, LogOut, Code, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { streamerApi } from '../../lib/api';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'streamer' | 'admin'>('streamer');
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  useEffect(() => {
    const nativeToken = localStorage.getItem('nativeToken');
    // If native JWT exist but Firebase isn't synced, user uses JWT only.
    // Auth logic will reflect native or firebase in Dashboard
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u || (nativeToken ? { uid: 'jwt-user' } as Partial<User> as User : null));
      if (u || nativeToken) {
         try {
            const me = await streamerApi.getMe();
            setRole(me?.role || 'streamer');
         } catch(e) {}
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('nativeToken');
    signOut(auth);
    setRole('streamer');
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 glass-panel bg-white/[0.03]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#7C3AED] to-[#00FFFF] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,255,255,0.2)]">
             <Code size={22} className="text-white drop-shadow-md" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-chrome italic uppercase px-1 overflow-visible">
            ProTip
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          {user ? (
            <div className="flex items-center gap-6">
               {role === 'admin' && (
                 <Link 
                   to="/adminDashboard" 
                   className={cn(
                     "text-sm font-bold transition-all hover:text-[#00FFFF] flex items-center gap-2",
                     location.pathname.startsWith('/adminDashboard') ? "text-[#00FFFF] drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]" : "text-zinc-400"
                   )}
                 >
                   <ShieldCheck size={16} />
                   <span className="hidden sm:inline">Admin Dashboard</span>
                 </Link>
               )}
               <Link 
                to="/dashboard" 
                className={cn(
                  "text-sm font-bold transition-all hover:text-[#7C3AED] flex items-center gap-2",
                  isDashboard ? "text-[#7C3AED] drop-shadow-[0_0_10px_rgba(124,58,237,0.5)]" : "text-zinc-400"
                )}
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <button 
                onClick={handleSignOut}
                className="text-zinc-500 hover:text-white transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link 
              to="/dashboard"
              className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-black uppercase tracking-widest hover:brightness-90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
