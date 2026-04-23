import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Users, CreditCard, Calendar, Activity, Zap, ShieldAlert, History, Settings, UserX, UserCheck } from 'lucide-react';
import { adminApi, streamerApi } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

type AdminTab = 'overview' | 'streamers' | 'plans' | 'reviews' | 'webhooks' | 'audit';

export default function AdminDashboard() {
  const [streamers, setStreamers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const fetchAdminData = async () => {
    const token = localStorage.getItem('nativeToken');
    if (!token) {
       window.location.href = '/admindashboard/login';
       return;
    }

    setLoading(true);
    try {
      const [allStreamers, allPlans, allReviews] = await Promise.all([
        adminApi.listStreamers(),
        adminApi.getPlans(),
        adminApi.getReviews()
      ]);
      
      setStreamers(allStreamers || []);
      setPlans(allPlans || []);
      setReviews(Array.isArray(allReviews) ? allReviews : []);
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        if (e.response?.status === 401) {
           window.location.href = '/admindashboard/login';
        } else {
           setAccessDenied(true);
        }
      } else {
        toast.error("Failed to sync with secure core. Retrying...");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReviewStatus = async (reviewId: string, status: 'approved' | 'rejected') => {
     try {
        await adminApi.updateReviewStatus(reviewId, status);
        toast.success(`Review ${status}`);
        fetchAdminData();
     } catch (err) {
        toast.error("Failed to update status");
     }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  if (accessDenied) {
    return (
      <div className="min-h-screen pt-40 px-4 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 border border-red-500/20 mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
           <ShieldAlert size={48} />
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-4 text-chrome">Clearance Denied</h1>
        <p className="text-zinc-500 max-w-sm mb-8">This frequency is encrypted for Executive Directors only. Non-authorized access attempts will be logged.</p>
        <button onClick={() => window.location.href = '/dashboard'} className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-bold transition-all uppercase tracking-widest text-sm">Return to Hub</button>
      </div>
    );
  }

  const filteredStreamers = streamers.filter(s => 
    s.username?.toLowerCase().includes(search.toLowerCase()) || 
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const mrr = streamers.reduce((acc, curr) => {
    const plan = plans.find(p => p.id === curr.planId);
    if (!curr.isTrial && plan) return acc + (plan.price || 0);
    return acc;
  }, 0);

  if (loading) {
    return <div className="min-h-screen pt-32 flex justify-center text-cyan-400 font-bold">Initializing Secure Protocols...</div>;
  }

  return (
    <main className="pt-32 pb-20 max-w-7xl mx-auto px-4">
       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
         <div className="flex items-center gap-4">
           <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
              <ShieldAlert size={32} />
           </div>
           <div>
             <h1 className="text-4xl font-black text-chrome uppercase tracking-tighter">Admin Core</h1>
             <p className="text-zinc-400 font-medium">Platform Economics & Policy Management</p>
           </div>
         </div>
         <div className="flex gap-2 p-2 bg-white/5 rounded-2xl border border-white/10 overflow-x-auto">
            <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={16}/>} label="Overview" />
            <TabBtn active={activeTab === 'streamers'} onClick={() => setActiveTab('streamers')} icon={<Users size={16}/>} label="Streamers" />
            <TabBtn active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} icon={<Zap size={16}/>} label="Plans" />
            <TabBtn active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')} icon={<ShieldCheck size={16}/>} label="Reviews" />
            <TabBtn active={activeTab === 'webhooks'} onClick={() => setActiveTab('webhooks')} icon={<CreditCard size={16}/>} label="Financials" />
            <TabBtn active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<History size={16}/>} label="Audit Logs" />
         </div>
       </div>

       {activeTab === 'overview' && (
         <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <MetricCard title="Total Creators" value={streamers.length} icon={<Users />} />
             <MetricCard title="Active Trials" value={streamers.filter(s => s.isTrial).length} icon={<Calendar />} />
             <MetricCard title="Platform MRR" value={`₹${mrr}`} icon={<CreditCard />} highlight />
             <MetricCard title="System Load" value="Optimal" icon={<Activity />} />
           </div>
           {/* Add charts here in the future if needed */}
         </div>
       )}

       {activeTab === 'streamers' && (
         <div className="glass-panel p-6 rounded-3xl animate-in fade-in slide-in-from-bottom-4 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest">Creator CRM</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input 
                   type="text" 
                   placeholder="Search ID, email, username..." 
                   className="bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm w-72 focus:outline-none focus:border-cyan-500/50 text-white placeholder-zinc-500"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-black/60 text-zinc-500 text-xs uppercase font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Streamer</th>
                    <th className="px-6 py-4">System Tier</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStreamers.map(s => (
                    <tr key={s._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                         <div className="font-bold text-white">{s.displayName || s.username}</div>
                         <div className="text-xs text-zinc-500">@{s.username} • {s.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-white/10 rounded-md text-xs font-bold uppercase">{s.planId || 'rookie'}</span>
                        {s.isTrial && <span className="ml-2 px-2 py-1 bg-purple-500/20 text-purple-400 rounded-md text-[10px] font-bold uppercase border border-purple-500/30">Trial</span>}
                      </td>
                      <td className="px-6 py-4">
                         <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${s.role === 'banned' ? 'bg-red-500' : 'bg-green-500'}`} /> {s.role === 'banned' ? 'SUSPENDED' : 'ACTIVE'}</span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                         <button className="text-cyan-400 hover:bg-cyan-500/20 px-3 py-1 rounded text-xs font-bold border border-cyan-500/20 bg-cyan-500/10">Edit</button>
                         <button className="text-red-400 hover:bg-red-500/20 px-3 py-1 rounded text-xs font-bold border border-red-500/20 bg-red-500/10">Ban</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
       )}

       {activeTab === 'reviews' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <div className="glass-panel p-6 rounded-3xl border border-white/10">
                <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-6">Subscription Reviews</h2>
                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full text-left text-sm text-zinc-300">
                    <thead className="bg-black/60 text-zinc-500 text-xs uppercase font-black tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Streamer</th>
                        <th className="px-6 py-4">Plan Request</th>
                        <th className="px-6 py-4">Transaction ID</th>
                        <th className="px-6 py-4">Proof</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {reviews.length === 0 && <tr><td colSpan={6} className="text-center py-20 text-zinc-600 italic">No pending reviews.</td></tr>}
                       {reviews.map(req => (
                          <tr key={req._id}>
                             <td className="px-6 py-4">
                                <div className="font-bold text-white">{req.streamerName}</div>
                                <div className="text-[10px] text-zinc-500">{req.streamerEmail}</div>
                             </td>
                             <td className="px-6 py-4 uppercase font-black text-xs">{req.planName}</td>
                             <td className="px-6 py-4 font-mono text-xs">{req.transactionId}</td>
                             <td className="px-6 py-4">
                                {req.screenshotUrl && <a href={req.screenshotUrl} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Link</a>}
                             </td>
                             <td className="px-6 py-4">
                                <span className={cn(
                                   "text-[10px] font-black uppercase px-2 py-1 rounded-md",
                                   req.status === 'pending' ? "bg-amber-500/20 text-amber-500" : 
                                   req.status === 'approved' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}>{req.status}</span>
                             </td>
                             <td className="px-6 py-4 text-right space-x-2">
                                {req.status === 'pending' && (
                                   <>
                                      <button onClick={() => handleUpdateReviewStatus(req._id, 'approved')} className="text-green-400 hover:bg-green-500/20 px-3 py-1 rounded text-[10px] font-bold border border-green-500/20 bg-green-500/10">Approve</button>
                                      <button onClick={() => handleUpdateReviewStatus(req._id, 'rejected')} className="text-red-400 hover:bg-red-500/20 px-3 py-1 rounded text-[10px] font-bold border border-red-500/20 bg-red-500/10">Reject</button>
                                   </>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
       )}

       {activeTab === 'plans' && (
         <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
           {plans.map(plan => (
             <div key={plan.id} className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                   <h3 className="text-xl font-black uppercase text-white tracking-widest">{plan.name} <span className="text-sm font-medium text-zinc-500 border border-white/10 bg-white/5 rounded px-2 py-0.5 ml-2">{plan.id}</span></h3>
                   <p className="text-zinc-400 text-sm mt-1">₹{plan.price}/mo • {plan.features.maxWidgets} Widgets • {plan.features.ttsVoices.length} TTS Voices</p>
                </div>
                <button className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all border border-white/10 whitespace-nowrap">Edit Pricing & Features</button>
             </div>
           ))}
           <button className="w-full py-4 text-sm font-bold text-zinc-500 hover:text-white border border-dashed border-white/10 hover:border-white/30 rounded-2xl transition-all uppercase tracking-widest bg-black/20 hover:bg-black/40">
             + Add Custom Tier
           </button>
         </div>
       )}
       
       {activeTab === 'webhooks' && (
         <div className="py-20 text-center">
            <CreditCard className="mx-auto text-zinc-700 w-16 h-16 mb-4" />
            <p className="text-zinc-500 font-bold tracking-widest uppercase">Financial Module Loading...</p>
         </div>
       )}

       {activeTab === 'audit' && (
         <div className="py-20 text-center">
            <History className="mx-auto text-zinc-700 w-16 h-16 mb-4" />
            <p className="text-zinc-500 font-bold tracking-widest uppercase">Audit Logs Database Connected</p>
         </div>
       )}

    </main>
  );
}

function TabBtn({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-bold transition-all ${active ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
    >
      {icon} {label}
    </button>
  );
}

function MetricCard({ title, value, icon, highlight }: { title: string, value: string | number, icon: any, highlight?: boolean }) {
  return (
    <div className={`glass-panel p-6 rounded-[2rem] flex flex-col gap-4 ${highlight ? 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-transparent relative overflow-hidden' : 'border border-white/10 bg-black/40'}`}>
       {highlight && <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={100} /></div>}
       <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${highlight ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(0,255,255,0.5)]' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
          {icon}
       </div>
       <div className="relative z-10">
         <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-1">{title}</p>
         <h3 className={`text-3xl font-black ${highlight ? 'text-white drop-shadow-md' : 'text-zinc-200'}`}>{value}</h3>
       </div>
    </div>
  )
}
