import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  Plus, Settings, Copy, ExternalLink, 
  IndianRupee, Activity, Users, Wallet,
  CheckCircle2, AlertCircle, Volume2, ShieldCheck,
  CreditCard, Layout, History, BarChart3, Globe,
  Palette, Play, Zap, X, Smartphone, ArrowRight
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { auth, googleProvider, RecaptchaVerifier, signInWithPhoneNumber } from '../lib/firebase';
import { CyberToggle } from '../components/CyberToggle';
import { FuturisticCard } from '../components/FuturisticCard';
import { streamerApi, widgetApi, donationApi, adminApi, authApi } from '../lib/api';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { Streamer, Donation, Widget, PaymentGateway, SystemSettings, SubscriptionPlan } from '../types';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { SubscriptionCard } from '../components/SubscriptionCard';
import GatewayManager from '../components/dashboard/GatewayManager';
import WidgetCustomizer from '../components/dashboard/WidgetCustomizer';
import HistoryLog from '../components/dashboard/HistoryLog';
import BrandingManager from '../components/dashboard/BrandingManager';
import PlatformSettingsComponent from '../components/dashboard/PlatformSettings';
import PlanManager from '../components/dashboard/PlanManager';
import SetupGuide from '../components/dashboard/SetupGuide';
import PaymentGuide from '../components/dashboard/PaymentGuide';

type Tab = 'overview' | 'widgets' | 'payments' | 'history' | 'admin' | 'branding' | 'platform' | 'plans' | 'setup';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [streamer, setStreamer] = useState<Streamer | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [totalEarningStat, setTotalEarningStat] = useState(0);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const initialTab = (new URLSearchParams(location.search).get('tab') as Tab) || 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [reviewRequests, setReviewRequests] = useState<any[]>([]);
  const [allReviewRequests, setAllReviewRequests] = useState<any[]>([]);
  const [reviewFormData, setReviewFormData] = useState({
    show: false,
    planId: '',
    planName: '',
    transactionId: '',
    screenshotUrl: '',
    upiUrl: '',
    amount: 0,
    billingCycle: 'monthly' as 'monthly' | 'yearly'
  });

  const [paymentSelection, setPaymentSelection] = useState<{ show: boolean, plan: SubscriptionPlan | null, cycle: 'monthly' | 'yearly' }>({ show: false, plan: null, cycle: 'monthly' });

  const handleSubscriptionChoice = (plan: SubscriptionPlan) => {
    if (plan.price === 0) {
      toast.success("Switched to trial/free tier successfully!");
      return;
    }
    setPaymentSelection({ show: true, plan, cycle: billingCycle });
  };

  const startPayment = (method: 'gateway' | 'upi') => {
    const { plan, cycle } = paymentSelection;
    if (!plan) return;
    
    const pVal = cycle === 'yearly' ? Math.floor(plan.price * 0.8 * 12) : plan.price;
    setPaymentSelection({ ...paymentSelection, show: false });

    if (method === 'upi') {
      const upiString = `upi://pay?pa=${systemSettings?.adminUpiId || 'admin@upi'}&pn=${encodeURIComponent(systemSettings?.adminUpiName || 'Boost Platform')}&am=${pVal}&tn=${encodeURIComponent(`Sub: ${plan.name} (${cycle}) for ${streamer?.username}`)}`;
      setReviewFormData({
        ...reviewFormData,
        show: true,
        planId: plan.id,
        planName: `${plan.name} (${cycle})`,
        upiUrl: upiString,
        amount: pVal,
        billingCycle: cycle,
        transactionId: '',
        screenshotUrl: ''
      });
    } else {
      window.location.href = `/api/payments/create-session?planId=${plan.id}&cycle=${cycle}&streamerId=${streamer?._id}`;
      toast.loading("Redirecting to secure gateway...");
    }
  };

  const handleActivateQueued = async (queueId: string) => {
    const ok = window.confirm("CANCELLATION WARNING: Activating this plan now will immediately CANCEL your current active plan. No refunds for the remaining time of the old plan. Are you sure?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/me/subscription/activate-queued/${queueId}`, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` }
      });
      if (!res.ok) throw new Error("Activation failed");
      toast.success("New plan activated! Previous plan cancelled.");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Activation failed");
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewFormData.transactionId || !reviewFormData.screenshotUrl) {
      toast.error("Please provide transaction ID and screenshot URL.");
      return;
    }
    try {
      const res = await fetch('/api/subscriptions/review', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}`
        },
        body: JSON.stringify({
          planId: reviewFormData.planId,
          planName: reviewFormData.planName,
          transactionId: reviewFormData.transactionId,
          screenshotUrl: reviewFormData.screenshotUrl,
          amount: reviewFormData.amount,
          billingCycle: reviewFormData.billingCycle
        })
      });
      if (!res.ok) throw new Error("Submission failed");
      toast.success("Review request submitted!");
      setReviewFormData({ ...reviewFormData, show: false, transactionId: '', screenshotUrl: '' });
      fetchDashboardData();
    } catch (err) {
      toast.error("Failed to submit review.");
    }
  };

  useEffect(() => {
    const searchTab = new URLSearchParams(location.search).get('tab');
    if (searchTab) {
      setActiveTab(searchTab as Tab);
    }
  }, [location.search]);
  const [subscriptionQueue, setSubscriptionQueue] = useState<any[]>([]);
  const [allStreamers, setAllStreamers] = useState<Streamer[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  const currencyMap: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£'
  };

  // Auth Form states
  const [authMode, setAuthMode] = useState<'options' | 'email' | 'phone'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Setup Form states
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  const totalEarningsDisplay = totalEarningStat || 0;
  const totalTipsCount = donations.filter(d => d.status === 'verified').length;

  const fetchDashboardData = async () => {
    try {
      const s = await streamerApi.getMe();
      setStreamer(s);
      
      if (s) {
        setDisplayName(s.displayName);
        setUsername(s.username);
        const [w, dResponse, subReviews, q] = await Promise.all([
          widgetApi.list(),
          donationApi.list(),
          fetch('/api/subscriptions/review', { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` }
          }).then(res => res.ok ? res.json() : []),
          fetch('/api/me/subscription/queue', { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` }
          }).then(res => res.ok ? res.json() : [])
        ]);
        setWidgets(w);
        setDonations(dResponse.donations || []);
        setTotalEarningStat(dResponse.totalEarnings || 0);
        setReviewRequests(subReviews);
        setSubscriptionQueue(q);
        
        if (s.role === 'admin') {
          const [all, allReviews] = await Promise.all([
            adminApi.listStreamers(),
            fetch('/api/admin/subscriptions/review', {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('nativeToken') || ''}` }
            }).then(res => res.ok ? res.json() : [])
          ]);
          setAllStreamers(all);
          setAllReviewRequests(allReviews);
        }
      }
    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      if (err.response?.status === 404) {
        setStreamer(null); // Force setup
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await adminApi.getSettings();
        setSystemSettings(settings);
        setDbStatus('connected');
      } catch (err) {
        setDbStatus('disconnected');
      }

      try {
        const fetchPlansResp = await fetch('/api/public/plans');
        if (fetchPlansResp.ok) {
           const plansData = await fetchPlansResp.json();
           setAvailablePlans(plansData);
        } else {
           throw new Error("fallback");
        }
      } catch {
         // Fallback default plans
         setAvailablePlans([
            { id: 'rookie', name: 'Rookie', price: 299, currency: 'INR', features: { maxWidgets: 4, ttsVoices: ['en-US'] } } as SubscriptionPlan,
            { id: 'elite', name: 'Elite', price: 599, currency: 'INR', features: { maxWidgets: 10, ttsVoices: ['en-US', 'en-GB', 'en-AU'] } } as SubscriptionPlan,
            { id: 'legend', name: 'Legend', price: 999, currency: 'INR', features: { maxWidgets: 50, ttsVoices: ['en-US', 'en-GB', 'en-AU', 'fr-FR', 'hi-IN', 'celebrity'] } } as SubscriptionPlan
         ]);
      }
    };
    init();

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      const nativeToken = localStorage.getItem('nativeToken');
      if (nativeToken) {
        // Assume native user is valid, setup flow will handle 401s if token expired
        setUser({ isNative: true }); 
        fetchDashboardData();
        setLoading(false);
        return;
      }
      
      setUser(u);
      if (u) {
        fetchDashboardData();
      }
      setLoading(false);
    });

    return () => unsubAuth();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      toast.error(`Sign-in failed: ${err.message}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        if (!username) {
            toast.error("Username is required for registration.");
            return;
        }
        const res = await authApi.register({ email, password, username, displayName });
        localStorage.setItem('nativeToken', res.token);
        setUser(res.user);
        toast.success("Account created successfully!");
        fetchDashboardData();
      } else {
        const res = await authApi.login({ email, password });
        localStorage.setItem('nativeToken', res.token);
        setUser(res.user);
        fetchDashboardData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleSendCode = async () => {
    try {
      if (!phoneNumber.startsWith('+')) {
        toast.error("Phone number must include country code (e.g., +91...)");
        return;
      }
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
      toast.success("Verification code sent to your phone.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleVerifyCode = async () => {
    try {
      if (!confirmationResult) return;
      await confirmationResult.confirm(verificationCode);
      toast.success("Phone verified successfully!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTwitchSignIn = async () => {
    try {
      const response = await fetch('/api/auth/twitch/url');
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      window.open(url, 'twitch_auth', 'width=600,height=700');
    } catch (err: any) {
      toast.error(`Twitch connection failed: ${err.message}`);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const streamData = {
        displayName,
        username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
      };
      await streamerApi.setup(streamData);
      toast.success("Profile created successfully!");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(`Setup failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const updateGateways = async (type: string, config: any) => {
    if (!streamer) return;
    
    const secretKeys = ['stripeSecretKey', 'razorpayKeySecret'];
    const publicConfig: any = {};
    const secretConfig: any = {};
    
    Object.keys(config).forEach(key => {
      if (secretKeys.includes(key)) secretConfig[key] = config[key];
      else publicConfig[key] = config[key];
    });

    const existingGateways = streamer.gateways || [];
    const filtered = existingGateways.filter(g => g.type !== type);
    const updatedGateways = [...filtered, { type, config: publicConfig }];
    
    const existingSecrets = streamer.secrets || {};
    const updatedSecrets = { ...existingSecrets, ...secretConfig };

    try {
      await streamerApi.update({ 
        gateways: updatedGateways,
        secrets: updatedSecrets
      });
      fetchDashboardData();
      toast.success(`${type} configuration saved.`);
    } catch (err) {
      toast.error("Failed to save gateway config.");
    }
  };

  const handleToggleSubscription = async (sid: string, active: boolean) => {
    try {
      // In MongoDB we use firebaseUid as the ID in many places or the Mongo _id
      // Our admin route expects the mongo ID or UID? 
      // Checking server.ts... it uses req.params.uid and matches firebaseUid
      await streamerApi.update({ subscriptionActive: !active }); 
      fetchDashboardData();
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  const handleAddWidget = async (type: 'alert' | 'goal' | 'ticker' | 'toptipper') => {
    // We keep the check for single alert box, since we fixed the delete button bug
    if (type === 'alert' && widgets.some(w => w.type === 'alert')) {
      toast.error(`You already have an active alert box.`);
      return;
    }

    try {
      await widgetApi.create({
        type,
        config: type === 'ticker' ? { minAmount: 1, primaryColor: '#ef4444', tickerSpeed: 'normal', showText: true, tickerCount: 5, stickyText: '!protip', padding: 16 } : 
               type === 'goal' ? { minAmount: 1, primaryColor: '#3b82f6', goalAmount: 5000, goalTitle: 'New Goal', goalStartingAmount: 0, padding: 16, progressBarHeight: 20 } :
               type === 'toptipper' ? { minAmount: 1, primaryColor: '#eab308', padding: 16 } :
               { minAmount: 1, ttsEnabled: true, primaryColor: '#ea580c', animationType: 'fade-up', padding: 16, ttsVoice: 'en-US' }
      });
      fetchDashboardData();
      toast.success(`${type.toUpperCase()} overlay added!`);
    } catch (err) {
      toast.error("Failed to add widget.");
    }
  };

  if (loading) return <div className="pt-40 text-center text-neutral-500 italic">Authenticating {systemSettings?.platformName || 'Boost'} session...</div>;
  if (!user) {
    return (
      <main className="pt-24 px-4 text-center">
        <div id="recaptcha-container"></div>
        <div className="max-w-md mx-auto p-8 md:p-12 rounded-[2.5rem] bg-black/40 backdrop-blur-[20px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7C3AED] to-[#00FFFF]" />
          <div className="w-16 h-16 bg-[#7C3AED]/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-[#00FFFF] shadow-[0_0_20px_rgba(124,58,237,0.3)]">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-black text-chrome tracking-tight mb-2">Creator Login</h1>
          <p className="text-zinc-400 text-sm mb-8 font-medium">Choose your preferred way to sign in</p>

          <AnimatePresence mode="wait">
            {authMode === 'options' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                <button 
                  onClick={handleGoogleSignIn}
                  className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:brightness-90 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg"
                >
                  <img src="https://www.vectorlogo.zone/logos/google/google-icon.svg" className="w-5" alt="" />
                  Continue with Google
                </button>
                <button 
                  onClick={() => setAuthMode('email')}
                  className="w-full bg-white/5 text-white py-4 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95 border border-white/10 shadow-lg"
                >
                  <Globe size={18} />
                  Email & Password
                </button>
                <button 
                  onClick={() => setAuthMode('phone')}
                  className="w-full bg-white/5 text-white py-4 rounded-2xl font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3 active:scale-95 border border-white/10 shadow-lg"
                >
                  <Users size={18} />
                  Phone Number
                </button>
                <div className="pt-4 border-t border-white/10 mt-4">
                  <button 
                    onClick={handleTwitchSignIn}
                    className="w-full bg-[#9146FF] text-white py-4 rounded-2xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl"
                  >
                    <Play size={18} fill="currentColor" />
                    Sign in with Twitch
                  </button>
                </div>
              </motion.div>
            )}

            {authMode === 'email' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  <button type="button" onClick={() => setIsRegistering(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isRegistering ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Login</button>
                  <button type="button" onClick={() => setIsRegistering(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isRegistering ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>Register</button>
                </div>
                
                <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                  {isRegistering && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Username</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                          <input 
                            type="text" 
                            placeholder="kamalfps" 
                            value={username}
                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:border-[#00FFFF] outline-none text-white text-sm"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Display Name</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                          <input 
                            type="text" 
                            placeholder="Kamal FPS" 
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:border-[#00FFFF] outline-none text-white text-sm"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Email Address</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                      <input 
                        type="email" 
                        placeholder="hello@example.com" 
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:border-[#00FFFF] outline-none text-white text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 mb-1 block">Password</label>
                    <div className="relative">
                      <Settings className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:border-[#00FFFF] outline-none text-white text-sm"
                        required
                      />
                    </div>
                  </div>
                  
                  <button className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00FFFF] text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,255,255,0.2)] active:scale-95 mt-2">
                    {isRegistering ? 'Create Account' : 'Sign In'}
                  </button>
                  <div className="text-center mt-4">
                    <button type="button" onClick={() => setAuthMode('options')} className="text-zinc-500 text-sm hover:text-white transition-colors">← Back to options</button>
                  </div>
                </form>
              </motion.div>
            )}

            {authMode === 'phone' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 text-left">
                {!confirmationResult ? (
                  <>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="+91 98765 43210" 
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 focus:border-[#00FFFF] outline-none text-xl font-bold text-center tracking-wider text-white"
                    />
                    <button onClick={handleSendCode} className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00FFFF] text-black py-4 rounded-xl font-bold hover:opacity-90 shadow-[0_0_20px_rgba(0,255,255,0.2)] transition-all">
                      Send OTP
                    </button>
                  </>
                ) : (
                  <>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 block mb-1">Enter Verification Code</label>
                    <input 
                      type="text" 
                      placeholder="XXXXXX" 
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-4 px-4 focus:border-[#00FFFF] outline-none text-2xl font-black text-center tracking-[1rem] text-white"
                    />
                    <button onClick={handleVerifyCode} className="w-full bg-[#00FFFF] text-black py-4 rounded-xl font-bold hover:brightness-90 shadow-[0_0_20px_rgba(0,255,255,0.2)] transition-all">
                      Verify & Login
                    </button>
                  </>
                )}
                <div className="text-center">
                  <button onClick={() => { setAuthMode('options'); setConfirmationResult(null); }} className="text-zinc-500 text-sm hover:text-white mt-2 transition-colors">← Back to options</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    );
  }

  if (!streamer) {
    return (
      <main className="pt-32 px-4 max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-chrome tracking-tight mb-2">Claim your handle</h1>
          <p className="text-zinc-400 font-medium">Kickstart your zero-commission journey.</p>
        </div>
        <form onSubmit={handleSetup} className="space-y-8 bg-black/40 p-10 rounded-[2.5rem] border border-white/10 backdrop-blur-[20px] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7C3AED] to-[#00FFFF]" />
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Pick a username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-600 text-sm">boost.live/t/</span>
                <input 
                  required
                  placeholder="kamalfps"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-[8.5rem] pr-4 focus:border-[#00FFFF] outline-none transition-colors font-bold text-white shadow-inner"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Display Name</label>
              <input 
                required
                placeholder="Kamal FPS"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 focus:border-[#00FFFF] outline-none transition-colors font-bold text-white shadow-inner"
              />
            </div>
          </div>
          <button className="w-full bg-gradient-to-r from-[#7C3AED] to-[#00FFFF] text-black py-5 rounded-[1.5rem] font-black text-lg uppercase tracking-widest hover:opacity-90 transition-all shadow-[0_0_30px_rgba(0,255,255,0.2)] active:scale-95">
            Create Profile
          </button>
          <button type="button" onClick={() => { localStorage.removeItem('nativeToken'); signOut(auth); setUser(null); }} className="w-full text-zinc-500 hover:text-white text-sm transition-colors">Sign Out</button>
        </form>
      </main>
    );
  }

  return (
    <main className="pt-24 px-4 max-w-7xl mx-auto pb-20">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-bold mb-1 tracking-tight">{systemSettings?.platformName || 'Boost'} <span className="text-orange-500">Console</span></h1>
          <p className="text-neutral-500 text-sm font-medium">Logged in as {streamer.displayName} (@{streamer.username})</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* DB Connection LED Indicator */}
          <div className="bg-neutral-900 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md">
            <div className="relative flex h-3 w-3">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                dbStatus === 'connected' ? "bg-green-400" : dbStatus === 'disconnected' ? "bg-red-400" : "bg-yellow-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-3 w-3",
                dbStatus === 'connected' ? "bg-green-500" : dbStatus === 'disconnected' ? "bg-red-500" : "bg-yellow-500"
              )}></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-widest text-neutral-500 uppercase leading-none mb-1">System Engine</span>
              <span className="text-xs font-bold text-neutral-300 leading-none">
                {dbStatus === 'connected' ? "DATABASE LINKED" : dbStatus === 'disconnected' ? "LINK SEVERED" : "INITIALIZING"}
              </span>
            </div>
            <button 
              onClick={async () => {
                setDbStatus('checking');
                fetchDashboardData();
                setDbStatus('connected');
                toast.info("Syncing with core engine...");
              }}
              className="ml-2 p-1.5 hover:bg-white/5 rounded-lg transition-colors text-neutral-500 hover:text-white"
              title="Refresh Core Connection"
            >
              <Activity size={14} />
            </button>
          </div>

          <a 
            href={`/t/${streamer.username}`} 
            target="_blank" 
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-bold shadow-lg"
          >
             <ExternalLink size={16} /> My Tipping Page
          </a>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1 bg-neutral-200 dark:bg-white/5 p-1.5 rounded-2xl w-fit mb-10 overflow-x-auto no-scrollbar border border-neutral-300 dark:border-white/5">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={16} />} label="Overview" />
        <TabButton active={activeTab === 'widgets'} onClick={() => setActiveTab('widgets')} icon={<Layout size={16} />} label="Overlays" />
        <TabButton active={activeTab === 'branding'} onClick={() => setActiveTab('branding')} icon={<Palette size={16} />} label="Branding" />
        <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} icon={<CreditCard size={16} />} label="Gateways" />
        <TabButton active={activeTab === 'setup'} onClick={() => setActiveTab('setup')} icon={<Play size={16} />} label="OBS Connection" />
        <TabButton active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} icon={<Zap size={16} />} label="My Subscription" />
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={16} />} label="Log" />
      </div>

      {activeTab === 'plans' && (
        <motion.div key="user-plans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-white">Your Subscription</h2>
           </div>

           {/* Current Subscription Details */}
           <div className="glass-panel p-8 rounded-[2rem] border border-white/10 relative overflow-hidden bg-white/[0.02]">
             <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                <Zap size={160} />
             </div>
             
             <div className="relative z-10">
               <h3 className="text-xl font-bold text-neutral-400 mb-1">Current Plan</h3>
               <div className="flex items-center gap-4 mb-6">
                 <h4 className="text-4xl font-black text-white uppercase tracking-tight">
                   {availablePlans.find(p => p.id === streamer.planId)?.name || 'Rookie (Default)'}
                 </h4>
                 {streamer.isTrial && streamer.trialEndsAt && (
                   <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-bold border border-purple-500/30 uppercase tracking-wider">
                     Active Trial
                   </span>
                 )}
               </div>

               {streamer.isTrial && streamer.trialEndsAt && (
                 <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 max-w-xl flex items-start gap-4">
                   <Zap className="text-purple-400 mt-1" size={20} />
                   <div>
                     <p className="text-sm font-bold text-white mb-1">Your Legend Trial is Active</p>
                     <p className="text-xs text-purple-300">
                       You have {Math.max(0, Math.ceil((new Date(streamer.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining in your trial. 
                       After this period, your plan will downgrade to Rookie unless you upgrade your infrastructure.
                     </p>
                   </div>
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                 <div className="space-y-2">
                   <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Max Widgets</p>
                   <p className="text-lg font-mono text-white flex items-center gap-2">
                     <span>{widgets.length} / {availablePlans.find(p => p.id === streamer.planId)?.features?.maxWidgets || 2} Used</span>
                     {widgets.length > (availablePlans.find(p => p.id === streamer.planId)?.features?.maxWidgets || 2) && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded-md uppercase tracking-widest font-black border border-red-500/50">Limit Exceeded</span>
                     )}
                   </p>
                 </div>
                 <div className="space-y-2">
                   <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">TTS Voices Unlocked</p>
                   <p className="text-lg font-mono text-white">
                     {availablePlans.find(p => p.id === streamer.planId)?.features.ttsVoices.length || 2} Voices
                   </p>
                 </div>
                 <div className="space-y-2">
                   <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Status</p>
                   <p className="text-lg font-mono text-green-400 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Active
                   </p>
                 </div>
               </div>
             </div>
           </div>

           <div className="mt-16 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                 <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Upgrade Your Infrastructure</h2>
                 {subscriptionQueue.length > 0 && (
                   <div className="mb-12 space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="h-0.5 flex-1 bg-white/5" />
                         <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-3">
                            <History size={14} /> Upgrade Queue
                         </h3>
                         <div className="h-0.5 flex-1 bg-white/5" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {subscriptionQueue.map((item: any) => (
                            <div key={item.id} className="bg-zinc-950/50 border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4 relative overflow-hidden group">
                               <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                                  <Zap size={60} />
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-orange-600/10 text-orange-500 rounded-2xl flex items-center justify-center font-bold text-xl italic">
                                     {item.planName.charAt(0)}
                                  </div>
                                  <div>
                                     <p className="font-bold text-white text-lg tracking-tight">{item.planName}</p>
                                     <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                                        Duration: {item.durationDays} Days
                                     </p>
                                  </div>
                               </div>
                               <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] font-bold text-zinc-600 italic">Purchased {new Date(item.purchasedAt).toLocaleDateString()}</span>
                                  <button 
                                    onClick={() => handleActivateQueued(item.id)}
                                    className="px-4 py-2 bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-orange-500/20 active:scale-95"
                                  >
                                     Activate Now
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                 )}
                 <p className="text-neutral-500 text-sm max-w-xl">Supercharge your stream with premium AI TTS voices, advanced animated overlays, and priority routing.</p>
              </div>

              <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 w-fit h-fit">
                 <button 
                   onClick={() => setBillingCycle('monthly')}
                   className={cn(
                     "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                     billingCycle === 'monthly' ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "text-zinc-500 hover:text-zinc-300"
                   )}
                 >
                   Monthly
                 </button>
                 <button 
                   onClick={() => setBillingCycle('yearly')}
                   className={cn(
                     "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                     billingCycle === 'yearly' ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "text-zinc-500 hover:text-zinc-300"
                   )}
                 >
                   Yearly <span className="bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-md">-20%</span>
                 </button>
              </div>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
              {availablePlans.map((plan) => {
                const finalPrice = billingCycle === 'yearly' ? Math.floor(plan.price * 0.8 * 12) : plan.price;
                const originalPrice = billingCycle === 'yearly' ? plan.price * 12 : undefined;
                return (
                  <SubscriptionCard 
                    key={plan.id}
                    title={plan.name}
                    price={`${plan.currency === 'INR' ? '₹' : plan.currency}${finalPrice}`}
                    originalPrice={originalPrice ? `${plan.currency === 'INR' ? '₹' : plan.currency}${originalPrice}` : undefined}
                    billingCycle={billingCycle}
                    features={[
                      `Max ${plan.features.maxWidgets} widgets`,
                      `${plan.features.ttsVoices.length} AI Voices`,
                      plan.features.customThemes ? "Liquid Theme Engine" : "Standard Themes",
                      plan.features.prioritySupport ? "Priority Support" : "Community Support"
                    ]}
                    highlight={plan.price > 500}
                    tier={plan.id === 'standard' ? 'rookie' : plan.id === 'pro' ? 'elite' : 'legend'}
                    onSubscribe={() => handleSubscriptionChoice(plan)}
                  />
                );
              })}
           </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <StatCard 
                title="Revenue" 
                value={`${currencyMap[streamer.preferredCurrency] || '₹'}${totalEarningsDisplay.toLocaleString('en-IN')}`} 
                icon={<Activity className="text-emerald-400" />} 
                badge="LIFETIME"
              />
              <StatCard 
                title="Total Tips" 
                value={totalTipsCount.toString()} 
                icon={<Users className="text-blue-400" />} 
              />
              <StatCard title="Global Reach" value="International" badge="GLOBAL" icon={<Globe className="text-purple-400" />} />
              <StatCard 
                title="Active Plan" 
                value={availablePlans.find(p => p.id === streamer.planId)?.name || 'Default Tier'} 
                badge={streamer.isTrial ? "TRIAL" : "ACTIVE"} 
                icon={<Zap className={cn(streamer.isTrial ? "text-amber-400" : "text-amber-500")} />} 
                change={streamer.isTrial ? `${Math.ceil((new Date(streamer.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left` : undefined}
              />
            </div>

            <FuturisticCard className="p-8">
              <h2 className="text-xl font-black mb-8 flex items-center justify-between tracking-tight">
                Recent Contributions
                <button className="text-sm font-bold text-orange-500 hover:underline px-4 py-2 hover:bg-orange-500/10 rounded-xl transition-colors">View All</button>
              </h2>
              <div className="space-y-4">
                {donations.length === 0 && <div className="text-center py-20 text-neutral-600 dark:text-neutral-400 italic">No donations received at this moment.</div>}
                {Array.isArray(donations) && donations.map(donation => (
                  <div key={donation.id} className="flex items-center justify-between p-5 rounded-2xl bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10 transition-all hover:bg-neutral-200 dark:hover:bg-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-600/20 text-orange-500 flex items-center justify-center font-bold text-xl uppercase italic border border-orange-500/20">
                        {donation.donorName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          {donation.donorName} 
                        </p>
                        <p className="text-sm text-neutral-400 mt-1 italic line-clamp-1">"{donation.message}"</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-xl tracking-tight">{donation.currency || '$'} {donation.amount}</p>
                      <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mt-1">
                        {donation.gateway?.replace('_', ' ') || 'Direct'} • {new Date(donation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </FuturisticCard>
          </motion.div>
        )}

        {activeTab === 'widgets' && (
          <motion.div key="widgets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
             <div className="bg-neutral-200/50 dark:bg-orange-600/[0.05] border border-neutral-300 dark:border-orange-500/20 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-xl">
               <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center shrink-0 border-4 border-orange-600/20 shadow-lg rotate-3">
                  <Play size={40} className="text-white ml-2" />
               </div>
               <div>
                 <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2 pr-2">How to Setup OBS / Streamlabs</h2>
                 <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
                   {systemSettings?.platformName || 'Boost'} works as a <span className="text-white font-bold italic">Browser Source</span>. Perfect for OBS, Streamlabs, and vMix. No plugin download required. 
                 </p>
                 <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    <li className="bg-neutral-950/50 p-3 rounded-xl border border-white/5 font-mono">1. Copy widget URL</li>
                    <li className="bg-neutral-950/50 p-3 rounded-xl border border-white/5 font-mono">2. Add "Browser Source"</li>
                    <li className="bg-neutral-950/50 p-3 rounded-xl border border-white/5 font-mono">3. Set 800x600 resolution</li>
                 </ol>
               </div>
             </div>

             <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Active Overlays</h2>
                <div className="flex gap-2">
                   <button onClick={() => handleAddWidget('alert')} className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#00FFFF] text-black rounded-xl text-xs font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                      <Plus size={14} /> Alert Box
                   </button>
                   <button onClick={() => handleAddWidget('goal')} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10">
                      <Plus size={14} /> Goal
                   </button>
                   <button onClick={() => handleAddWidget('ticker')} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10">
                      <Plus size={14} /> Recent Tippers
                   </button>
                   <button onClick={() => handleAddWidget('toptipper')} className="px-4 py-2 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10">
                      <Plus size={14} /> Top Tipper (Lifetime)
                   </button>
                </div>
             </div>

                  {widgets.map(w => (
                    <div key={w.id} className="glass-panel p-8 rounded-[2.5rem]">
                       <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                         <h3 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3 pr-2">
                           <div className="w-2 h-8 bg-orange-600 rounded-full" />
                           {w.type} WIDGET
                         </h3>
                         <div className="flex items-center gap-3 bg-black/5 dark:bg-black/20 px-4 py-3 rounded-2xl border border-black/5 dark:border-white/5">
                            <span className="text-[11px] font-mono text-neutral-500 truncate max-w-[200px]">.../overlay/{w.id}</span>
                            <button 
                             onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/overlay/${w.id}`); toast.success("Link copied to OBS source!"); }}
                             className="p-2 rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-500 hover:bg-orange-600 hover:text-white transition-all active:scale-95 border border-orange-500/20"
                             title="Copy Overlay URL"
                            >
                              <Copy size={16} />
                            </button>
                            <Link to={`/overlay/${w.id}`} target="_blank" className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-all border border-black/5 dark:border-white/5">
                              <ExternalLink size={16} />
                            </Link>
                         </div>
                       </div>
                       <WidgetCustomizer 
                         widget={w} 
                         onUpdate={fetchDashboardData} 
                         onDelete={fetchDashboardData}
                         allPlatformVoices={systemSettings?.availableTTSVoices || []}
                         allowedTTSVoices={availablePlans.find(p => p.id === streamer.planId)?.features.ttsVoices || []}
                       />
                    </div>
                  ))}

             {/* Real Test Trigger */}
             <div className="glass-panel p-8 rounded-[2.5rem] text-center space-y-6">
                <div>
                   <h2 className="text-xl font-bold mb-2 tracking-tight">End-to-End Test</h2>
                   <p className="text-sm text-neutral-500 max-w-md mx-auto">Trigger a real database record to test your OBS Browser Source and AI Voice integration.</p>
                </div>
                <button 
                  onClick={async () => {
                    if (!streamer) return;
                    try {
                      await donationApi.recordSuccess({
                        streamerId: streamer.firebaseUid,
                        donorName: 'Test Supporter',
                        amount: 69,
                        currency: '₹',
                        message: 'This is a test tip to verify your full stream setup! AI voice should play now.',
                        status: 'verified',
                      });
                      toast.success("Test tip triggered! Check your OBS or Overlay page.");
                      fetchDashboardData();
                    } catch (err) {
                      console.error(err);
                      toast.error("Failed to trigger test tip.");
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center gap-2 mx-auto"
                >
                  <Zap size={18} fill="currentColor" /> Trigger Live Test Alert
                </button>
             </div>
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <motion.div key="payments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="bg-neutral-200/50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-white/10 rounded-[2.5rem] p-10 backdrop-blur-sm shadow-xl">
                <div className="mb-10 text-center md:text-left">
                   <h2 className="text-3xl font-bold mb-2 tracking-tight">Financial Hub</h2>
                   <p className="text-neutral-500 max-w-xl">Integration your specific payment gateways. Go international with Stripe or stay local with UPI Direct.</p>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                   <GatewayManager gateways={streamer.gateways || []} onConnect={updateGateways} />
                   <PaymentGuide />
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <SetupGuide streamer={streamer} widgets={widgets} />
          </motion.div>
        )}

        {activeTab === 'admin' && streamer.role === 'admin' && (
          <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="glass-panel rounded-[2.5rem] p-10">
                <div className="mb-10">
                   <h2 className="text-3xl font-black mb-1 tracking-tight">Platform Admin</h2>
                   <p className="text-neutral-500">Manage all streamers and system-wide settings.</p>
                </div>
                
              <div className="space-y-4">
                  {allStreamers.map(s => (
                    <div key={s.id} className="p-6 rounded-2xl glass-panel flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center font-bold">
                          {s.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold">{s.displayName} (@{s.username})</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Role: {s.role}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button className="px-4 py-2 bg-neutral-200 dark:bg-white/5 rounded-lg text-xs font-bold hover:bg-neutral-300 dark:hover:bg-white/10 uppercase tracking-tighter">View Page</button>
                        <div className="flex flex-col items-center">
                          <CyberToggle 
                            id={`toggle-${s.id}`} 
                            checked={s.subscriptionActive} 
                            onChange={() => handleToggleSubscription(s.id, s.subscriptionActive)} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'branding' && (
          <motion.div key="branding" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="glass-panel rounded-[2.5rem] p-10">
                <div className="mb-10 text-center md:text-left">
                   <h2 className="text-3xl font-black mb-2 tracking-tight">Profile & Branding</h2>
                   <p className="text-neutral-500 max-w-xl">Customize your tipping page to match your stream aesthetic.</p>
                </div>
                <BrandingManager streamer={streamer} />
             </div>
          </motion.div>
        )}

        {activeTab === 'platform' && streamer.role === 'admin' && systemSettings && (
          <motion.div key="platform" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="glass-panel rounded-[2.5rem] p-10">
                <div className="mb-10 text-center md:text-left">
                   <h2 className="text-3xl font-black mb-2 tracking-tight">Platform Configuration</h2>
                   <p className="text-neutral-500">Manage global branding, administrators, and system-wide settings.</p>
                </div>
                <PlatformSettingsComponent settings={systemSettings} />
             </div>
          </motion.div>
        )}

        {activeTab === 'plans' && streamer.role === 'admin' && (
          <motion.div key="plans" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="bg-neutral-200/50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-white/10 rounded-[2.5rem] p-10 backdrop-blur-sm shadow-xl">
                <div className="mb-10">
                   <h2 className="text-3xl font-bold mb-1 tracking-tight">Plan Monetization</h2>
                   <p className="text-neutral-500">Configure feature gates and pricing for different creator tiers.</p>
                </div>
                <PlanManager settings={systemSettings} />
             </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="bg-neutral-200/50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-white/10 rounded-[2.5rem] p-10 backdrop-blur-sm shadow-xl">
                <div className="mb-10 flex items-center justify-between">
                   <div>
                     <h2 className="text-3xl font-bold mb-1 tracking-tight">Contribution Log</h2>
                     <p className="text-neutral-500">Real-time ledger of all tips received through StreamVibe.</p>
                   </div>
                </div>
                <HistoryLog donations={donations} />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentSelection.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
             <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-6">Select Payment Method</h3>
                <div className="space-y-4">
                   <button onClick={() => startPayment('gateway')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left">
                      <p className="font-bold text-white">Automatic Gateway</p>
                      <p className="text-xs text-zinc-500">Instant Activation</p>
                   </button>
                   <button onClick={() => startPayment('upi')} className="w-full p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left">
                      <p className="font-bold text-white">Direct UPI</p>
                      <p className="text-xs text-zinc-500">Manual Approval (30-60m)</p>
                   </button>
                </div>
                <button onClick={() => setPaymentSelection({ ...paymentSelection, show: false })} className="mt-6 w-full text-zinc-500 text-sm">Cancel</button>
             </div>
          </div>
        )}
        {reviewFormData.show && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel w-full max-w-xl p-8 rounded-[3rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-purple-500" />
              
              <div className="flex justify-between items-start mb-8">
                 <div>
                    <h3 className="text-2xl font-black text-chrome uppercase tracking-tighter">Upgrade to {reviewFormData.planName}</h3>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Manual Verification Required</p>
                 </div>
                 <button onClick={() => setReviewFormData({ ...reviewFormData, show: false })} className="p-2 hover:bg-white/5 rounded-full transition-colors text-zinc-500 hover:text-white">
                    <X size={24} />
                 </button>
              </div>

              <div className="space-y-6">
                 {/* Step 1: Scan & Pay */}
                 <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black">1</div>
                       <p className="text-sm font-bold text-zinc-200">Scan to Pay via UPI</p>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                       <div className="bg-white p-4 rounded-2xl shadow-xl">
                          {/* Placeholder for QR - In a real app we'd use a QR gen library */}
                          <div className="w-32 h-32 bg-zinc-200 border-4 border-zinc-100 flex items-center justify-center text-[8px] font-black uppercase text-zinc-400 text-center px-4">
                             QR COde generated for {reviewFormData.upiUrl?.split('am=')[1]?.split('&')[0]} INR
                          </div>
                       </div>
                       <a 
                          href={reviewFormData.upiUrl} 
                          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/5 flex items-center gap-2"
                       >
                         <Smartphone size={14} /> Open in UPI App
                       </a>
                       <p className="text-[10px] text-zinc-500 font-mono">{systemSettings?.adminUpiId}</p>
                    </div>
                 </div>

                 {/* Step 2: Upload Proof */}
                 <div className="bg-white/5 p-6 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">2</div>
                       <p className="text-sm font-bold text-zinc-200">Submit Verification Details</p>
                    </div>
                    <div className="space-y-4">
                       <input 
                          type="text"
                          placeholder="Transaction ID / UTR Number"
                          value={reviewFormData.transactionId}
                          onChange={(e) => setReviewFormData({ ...reviewFormData, transactionId: e.target.value })}
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-purple-500"
                       />
                       <div className="relative group cursor-pointer">
                          <input 
                            type="text"
                            placeholder="Snapshot URL (or upload below)"
                            value={reviewFormData.screenshotUrl}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, screenshotUrl: e.target.value })}
                            className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-purple-500"
                          />
                       </div>
                    </div>
                 </div>

                 <button 
                  onClick={handleSubmitReview}
                  className="w-full py-4 bg-gradient-to-r from-[#7C3AED] to-[#00FFFF] text-black font-black uppercase tracking-widest text-sm rounded-2xl shadow-[0_0_30px_rgba(124,58,237,0.3)] hover:brightness-110 active:scale-95 transition-all"
                 >
                    Submit for Approval
                 </button>
                 
                 <p className="text-[10px] text-zinc-600 text-center font-medium px-8 italic">
                   Note: Approvals usually take 30-60 minutes between 10AM and 10PM. You will receive an email once activated.
                 </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap border",
        active 
          ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-black dark:border-white" 
          : "bg-neutral-200/50 text-neutral-700 border-transparent hover:bg-neutral-300 dark:bg-neutral-800/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon, badge, change }: any) {
  return (
    <div className="glass-panel glass-card-hover rounded-[2rem] p-8 relative overflow-hidden group">
      {badge && <span className="absolute top-4 right-4 bg-orange-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded italic shadow-lg">{badge}</span>}
      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
        {icon}
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">{title}</p>
          {change && <span className="text-[10px] font-bold text-emerald-400">{change}</span>}
        </div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}
