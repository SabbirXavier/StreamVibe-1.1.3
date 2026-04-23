export interface PaymentGateway {
  type: 'upi_direct' | 'razorpay' | 'stripe';
  config: {
    upiId?: string;
    razorpayKeyId?: string;
    razorpayKeySecret?: string;
    stripePublicKey?: string;
    connected?: boolean;
    enabled?: boolean;
  };
}

export interface SystemSettings {
  id: string;
  platformName: string;
  logoUrl: string;
  allowedAdmins: string[]; // List of emails
  commissionRate: number;
  maintenanceMode: boolean;
  availableTTSVoices: string[]; // List of voices like ['Aditi', 'Raveena', 'Matthew', 'Joey']
  adminUpiId?: string;
  adminUpiName?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  trialDays: number; // Duration of trial in days
  features: {
    maxWidgets: number;
    customThemes: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    ttsVoices: string[]; // List of enabled AI voices for this plan
    handlingFee: number; // Platform fee for this plan
  };
}

export interface SubscriptionReviewRequest {
  id: string;
  streamerId: string;
  streamerEmail: string;
  streamerName: string;
  planId: string;
  planName: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  transactionId: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  resolvedAt?: any;
}

export interface SubscriptionQueue {
  id: string;
  streamerId: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  durationDays: number;
  status: 'queued' | 'active' | 'cancelled';
  purchasedAt: any;
  activatedAt?: any;
}

export interface Streamer {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  accentColor?: string;
  role: 'streamer' | 'admin';
  planId: string; // Reference to SubscriptionPlan
  isTrial: boolean;
  trialEndsAt?: any; 
  obsToken: string; 
  subscriptionActive: boolean;
  subscriptionExpiry?: any; 
  preferredCurrency: string; 
  createdAt: any;
  gateways: PaymentGateway[];
  secrets?: Record<string, string>;
  predefinedAmounts?: number[];
  tipsEnabledTag?: string;
  verifiedCreatorTag?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  kickUrl?: string;
}

export interface Donation {
  id: string;
  streamerId: string;
  donorName: string;
  donorImage?: string;
  amount: number; // Converted amount for streamer balance
  currency: string; // Converted currency symbol
  originalAmount?: number; // Raw amount sent by donor
  originalCurrency?: string; // Raw currency symbol sent by donor
  message: string;
  isTTSPlayed: boolean;
  gateway: string;
  status: 'pending' | 'verified';
  paymentId?: string; 
  createdAt: any; 
}

export interface WidgetConfig {
  minAmount: number;
  ttsEnabled?: boolean;
  ttsVoice?: string;
  primaryColor: string;
  progressColor?: string; // Color for the progress bar specifically
  boxGradient?: string; // e.g. "linear-gradient(to right, #000, #111)"
  progressGradient?: string; // e.g. "linear-gradient(to right, #f97316, #f59e0b)"
  animationType?: string;
  goalAmount?: number;
  goalTitle?: string;
  currentProgress?: number;
  goalStartingAmount?: number;
  goalStartDate?: any; 
  tickerSpeed?: 'slow' | 'normal' | 'fast';
  tickerCount?: number;
  showText?: boolean;
  stickyText?: string; 
  backgroundColor?: string;
  backgroundOpacity?: number;
  isPaused?: boolean;
  padding?: number; // Master Padding
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  width?: number; 
  height?: number; 
  progressBarHeight?: number; 
  alertFontSize?: number; 
  alertFontFamily?: string;
  alertBorderRadius?: number;
  elementPositions?: Record<string, { x: number; y: number; w?: number; h?: number; locked?: boolean }>; // Saved positions & dimensions
}

export interface Widget {
  id: string;
  streamerId: string;
  type: 'alert' | 'goal' | 'ticker' | 'toptipper';
  config: WidgetConfig;
}
