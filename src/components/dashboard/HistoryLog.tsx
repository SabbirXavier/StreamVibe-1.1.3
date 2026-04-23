import React from 'react';
import { toast } from 'sonner';
import { Donation } from '../../types';
import { 
  IndianRupee, Clock, CheckCircle2, Search, 
  Zap, AlertCircle, Check, Volume2, Loader2,
  Globe, CreditCard
} from 'lucide-react';
import { donationApi } from '../../lib/api';
import { cn } from '../../lib/utils';

interface Props {
  donations: Donation[];
  onUpdate?: () => void;
}

export default function HistoryLog({ donations, onUpdate }: Props) {
  const [resendingId, setResendingId] = React.useState<string | null>(null);

  const handleVerify = async (id: string) => {
    try {
      const res = await fetch(`/api/donations/${id}/verify`, { 
        method: 'POST', 
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` 
        } 
      });
      if (!res.ok) throw new Error("Verification failed");
      toast.success("Tip verified! Alert triggered.");
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify tip.");
    }
  };

  const handleResendTTS = async (donationId: string) => {
    setResendingId(donationId);
    try {
      const res = await fetch(`/api/donations/${donationId}/resend-tts`, { 
        method: 'POST', 
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` 
        } 
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Alert resent to OBS!");
    } catch (err) {
      toast.error("Resend failed.");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
         <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
            <input 
              placeholder="Search by donor name..."
              className="w-full bg-neutral-950 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-orange-500 outline-none transition-all"
            />
         </div>
         <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">Export CSV</button>
            <button className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-500 transition-all">Filter</button>
         </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              <th className="px-6 py-3">Donor</th>
              <th className="px-6 py-3">Message</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Gateway</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-20 text-neutral-600 italic">No transactions found.</td>
              </tr>
            )}
            {donations.map(d => (
              <tr key={d.id} className="bg-white/5 dark:bg-neutral-950/50 border border-black/5 dark:border-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-neutral-950 transition-all group">
                <td className="px-6 py-4 rounded-l-2xl">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-600/10 text-orange-500 flex items-center justify-center font-bold text-xs">
                        {d.donorName.charAt(0)}
                      </div>
                      <span className="font-bold text-sm text-black dark:text-white">{d.donorName}</span>
                   </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs text-neutral-400 line-clamp-1 italic">"{d.message}"</p>
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold text-white text-sm">{d.currency} {d.amount}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] bg-white/5 px-3 py-1 rounded border border-white/10 text-neutral-400 uppercase font-mono tracking-wider w-fit flex items-center gap-2">
                      {d.gateway === 'razorpay' && <CreditCard size={10} className="text-indigo-400" />}
                      {d.gateway === 'stripe' && <Globe size={10} className="text-blue-400" />}
                      {d.gateway === 'upi_direct' && <IndianRupee size={10} className="text-emerald-400" />}
                      {d.gateway?.replace('_', ' ') || 'direct'}
                    </span>
                    {d.paymentId && <span className="text-[8px] text-zinc-600 font-mono">ID: {d.paymentId}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                   {d.status === 'verified' ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold uppercase">
                           <CheckCircle2 size={12} /> Success
                        </div>
                        <button 
                          onClick={() => handleResendTTS(d.id)}
                          disabled={resendingId === d.id}
                          className={cn(
                            "group/tts relative px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 overflow-hidden",
                            "bg-neutral-900 text-orange-500 border border-white/10 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
                            resendingId === d.id && "opacity-50 cursor-not-allowed"
                          )}
                          title="Re-play alert & TTS in OBS"
                        >
                           <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover/tts:translate-x-[100%] transition-transform duration-700" />
                           {resendingId === d.id ? (
                             <Loader2 size={12} className="animate-spin" />
                           ) : (
                             <Volume2 size={12} className="group-hover/tts:scale-125 transition-transform duration-300" />
                           )}
                           <span className="relative z-10">Replay Alert</span>
                        </button>
                      </div>
                   ) : (
                      <button 
                       onClick={() => handleVerify(d.id)}
                       className="flex items-center gap-1.5 text-orange-500 text-[10px] font-bold uppercase hover:bg-orange-500/10 px-2 py-1 rounded-lg transition-all border border-orange-500/20"
                      >
                         <AlertCircle size={12} /> Pending - Activate
                      </button>
                   )}
                </td>
                <td className="px-6 py-4 rounded-r-2xl">
                  <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-mono">
                    <Clock size={12} /> {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
