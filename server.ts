import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import * as googleTts from 'google-tts-api';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Initialize Firebase Admin for Token Verification
if (!admin.apps.length) {
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id
      });
      console.log("Firebase Admin initialized with Service Account. Forced Project ID:", projectId || serviceAccount.project_id);
    } else {
      admin.initializeApp({
        projectId: projectId
      });
      console.log("Firebase Admin initialized with default credentials and project ID:", projectId);
    }
  } catch (err) {
    console.error("Firebase Admin Init Error:", err);
  }
}

// MongoDB Connection
let MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.set('bufferCommands', false); 

if (MONGODB_URI) {
  // AUTO-FIX: If password contains unencoded '@', sanitize it.
  if (MONGODB_URI.startsWith('mongodb') && MONGODB_URI.split('@').length > 2) {
    const parts = MONGODB_URI.split('@');
    const clusterPart = parts.pop();
    const authPart = parts.join('%40');
    MONGODB_URI = `${authPart}@${clusterPart}`;
    console.log("MONGODB_URI: Automatically sanitized URI.");
  }

  mongoose.connect(MONGODB_URI, { 
    serverSelectionTimeoutMS: 5000 
  })
    .then(() => console.log("Connected to MongoDB Core Engine"))
    .catch(err => {
      console.error("MongoDB Connection Error:", err);
    });
} else {
  console.warn("MONGODB_URI is not defined.");
}

// TTS is handled client-side via Web Speech API

// MongoDB Schemas
const streamerSchema = new mongoose.Schema({
  firebaseUid: { type: String, sparse: true, unique: true }, // Optional for native auth
  email: { type: String, sparse: true, unique: true },
  password: { type: String },
  username: { type: String, required: true, unique: true, lowercase: true },
  displayName: String,
  role: { type: String, default: 'streamer' },
  bio: String,
  accentColor: { type: String, default: '#ea580c' },
  profileImage: String,
  coverImage: String,
  preferredCurrency: { type: String, default: 'INR' },
  subscriptionActive: { type: Boolean, default: true },
  subscriptionExpiry: Date,
  planId: { type: String, default: 'standard' },
  isTrial: { type: Boolean, default: false },
  trialEndsAt: Date,
  predefinedAmounts: { type: [Number], default: [50, 100, 500] },
  tipsEnabledTag: { type: String, default: 'Tips Enabled' },
  verifiedCreatorTag: { type: String, default: 'Verified Creator' },
  youtubeUrl: String,
  twitchUrl: String,
  kickUrl: String,
  obsToken: String,
  gateways: [{ type: Object }], // Public config
  secrets: { type: Object, default: {} }, // Sensitive keys
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const widgetSchema = new mongoose.Schema({
  streamerId: { type: String, required: true }, // firebaseUid
  type: String,
  config: Object,
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const donationSchema = new mongoose.Schema({
  streamerId: { type: String, required: true },
  donorName: String,
  donorImage: String,
  amount: Number,
  currency: String,
  originalAmount: Number,
  originalCurrency: String,
  message: String,
  gateway: { type: String, default: 'unknown' },
  status: { type: String, enum: ['pending', 'verified'], default: 'pending' },
  isTTSPlayed: { type: Boolean, default: false },
  orderId: String,
  paymentId: String,
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: Object
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: Number,
  currency: { type: String, default: '₹' },
  trialDays: Number,
  features: Object,
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const webhookEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  provider: { type: String, required: true },
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const trialRecordSchema = new mongoose.Schema({
  email: { type: String, index: true },
  ipAddress: { type: String, index: true },
  channelUrl: { type: String, index: true },
  streamerId: { type: String, required: true },
  denialReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const ttsCacheSchema = new mongoose.Schema({
  textHash: { type: String, required: true, unique: true },
  audioData: { type: String, required: true }, // Base64 audio
  expiresAt: { type: Date, index: { expires: '1h' } }, // Optional auto-expire
  createdAt: { type: Date, default: Date.now }
});

const subscriptionReviewRequestSchema = new mongoose.Schema({
  streamerId: { type: String, required: true },
  streamerEmail: String,
  streamerName: String,
  planId: { type: String, required: true },
  planName: String,
  amount: Number,
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  transactionId: { type: String, required: true },
  screenshotUrl: String,
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date
});

const subscriptionQueueSchema = new mongoose.Schema({
  streamerId: { type: String, required: true },
  planId: { type: String, required: true },
  planName: String,
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  durationDays: { type: Number, required: true },
  status: { type: String, default: 'queued', enum: ['queued', 'active', 'cancelled'] },
  purchasedAt: { type: Date, default: Date.now },
  activatedAt: Date
}, {
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    }
  }
});

const StreamerModel = mongoose.model('Streamer', streamerSchema);
const WidgetModel = mongoose.model('Widget', widgetSchema);
const DonationModel = mongoose.model('Donation', donationSchema);
const SettingsModel = mongoose.model('Settings', settingsSchema);
const PlanModel = mongoose.model('Plan', planSchema);
const WebhookEventModel = mongoose.model('WebhookEvent', webhookEventSchema);
const TrialRecordModel = mongoose.model('TrialRecord', trialRecordSchema);
const TTSCacheModel = mongoose.model('TTSCache', ttsCacheSchema);
const SubscriptionReviewRequestModel = mongoose.model('SubscriptionReviewRequest', subscriptionReviewRequestSchema);
const SubscriptionQueueModel = mongoose.model('SubscriptionQueue', subscriptionQueueSchema);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development';

// Helper to auto-elevate based on VITE_PLATFORM_ADMINS env var
const ensureAdminRole = async (streamer: any) => {
  if (!streamer || !streamer.email) return streamer;
  const adminEmailsVar = process.env.VITE_PLATFORM_ADMINS || '';
  
  // Create a base list of admins including hardcoded ones if necessary
  const hardcodedAdmins = [
    'xavierscot3454@gmail.com', 
    'promoidse@gmail.com', 
    'dcpromoidse@gmail.com'
  ].map(e => e.toLowerCase());
  
  const envAdmins = adminEmailsVar ? adminEmailsVar.split(',').map((e: string) => e.trim().toLowerCase()) : [];
  const allAdmins = Array.from(new Set([...hardcodedAdmins, ...envAdmins]));

  if (allAdmins.includes(streamer.email.toLowerCase()) && streamer.role !== 'admin') {
    streamer.role = 'admin';
    await streamer.save();
    console.log(`[Admin] Elevated user ${streamer.email} to admin role.`);
  }
  return streamer;
};

// Middleware: Verify Auth Token (Supports Firebase & Native JWT)
const verifyAuth = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    console.warn("[Auth] No token provided in request header.");
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    // Try to verify as Native JWT first
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { uid: decoded.userId }; // Map userId to uid for compatibility
      return next();
    } catch (jwtError) {
      // If it fails, assume it's a Firebase token and try verifying through Firebase
      if (admin.apps.length) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        return next();
      } else {
        throw new Error("Invalid Auth Token and Firebase is not initialized");
      }
    }
  } catch (error: any) {
    console.error("[Auth] Token verification failed:", error.message);
    res.status(401).json({ error: `Unauthorized: ${error.message}` });
  }
};

// Error Handler Wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('join-streamer', (streamerId) => socket.join(`streamer:${streamerId}`));
    socket.on('join-widget', (widgetId) => socket.join(`widget:${widgetId}`));
    socket.on('disconnect', () => console.log('user disconnected'));
  });

  console.log("Setting up common middleware...");
  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));
  app.use(cookieParser());

  // --- Native Auth Routes ---
  app.post('/api/auth/register', asyncHandler(async (req: any, res: any) => {
    const { email, password, username, displayName } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    try {
      const existingUser = await StreamerModel.findOne({ $or: [{ email }, { username: username.toLowerCase() }] });
      if (existingUser) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      let newUser = new StreamerModel({
        email,
        password: hashedPassword,
        username: username.toLowerCase(),
        displayName: displayName || username,
      });

      await newUser.save();
      newUser = await ensureAdminRole(newUser);

      const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: newUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }));

  app.post('/api/auth/login', asyncHandler(async (req: any, res: any) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      let user = await StreamerModel.findOne({ email });
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      user = await ensureAdminRole(user);

      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
      res.status(200).json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }));

  // API Routes
  app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
      status: 'ok', 
      db: dbStatus,
      domain: process.env.APP_URL 
    });
  });

  // --- Streamer Routes ---
  app.get('/api/streamers/:username', asyncHandler(async (req: any, res: any) => {
    const streamer = await StreamerModel.findOne({ username: req.params.username.toLowerCase() });
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    res.json(streamer);
  }));

  const getStreamerQuery = (uid: string) => ({
    $or: [
      { _id: uid.length === 24 ? uid : null },
      { firebaseUid: uid }
    ]
  });

  app.get('/api/me', verifyAuth, asyncHandler(async (req: any, res: any) => {
    let streamer = await StreamerModel.findOne(getStreamerQuery(req.user.uid));
    streamer = await ensureAdminRole(streamer);
    res.json(streamer);
  }));

  app.post('/api/me', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const existing = await StreamerModel.findOne(getStreamerQuery(req.user.uid));
    if (existing) return res.status(400).json({ error: 'Account already setup' });

    // Check username uniqueness
    const usernameTaken = await StreamerModel.findOne({ username: req.body.username.toLowerCase() });
    if (usernameTaken) return res.status(400).json({ error: 'Username already taken' });

    let newStreamer = new StreamerModel({
      ...req.body,
      firebaseUid: req.user.uid,
      username: req.body.username.toLowerCase(),
      email: req.user.email || req.body.email
    });
    
    await newStreamer.save();
    newStreamer = await ensureAdminRole(newStreamer);
    
    res.status(201).json(newStreamer);
  }));

  app.patch('/api/me', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const updateData = { ...req.body };
    
    // Auto-fetch profile/cover if social URLs are provided and images are empty
    if (updateData.youtubeUrl || updateData.twitchUrl || updateData.kickUrl) {
       // Simple regex/id fetch logic (in a real app we'd call APIs)
       // For now, we simulate the fetch logic
       if (!updateData.profileImage) {
          if (updateData.youtubeUrl) updateData.profileImage = `https://img.youtube.com/vi/${updateData.youtubeUrl.split('v=')[1] || 'default'}/mqdefault.jpg`;
          // ... more sophisticated logic could be added here
       }
    }

    const updated = await StreamerModel.findOneAndUpdate(
      getStreamerQuery(req.user.uid),
      { $set: updateData },
      { new: true }
    );
    res.json(updated);
  }));

  app.delete('/api/me', verifyAuth, asyncHandler(async (req: any, res: any) => {
    await StreamerModel.deleteOne(getStreamerQuery(req.user.uid));
    await WidgetModel.deleteMany({ streamerId: req.user.uid });
    res.json({ success: true });
  }));

  // --- Trial Routes ---
  app.post('/api/trial/claim', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const { channelUrl } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const streamer = await StreamerModel.findOne(getStreamerQuery(req.user.uid));

    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    
    if (streamer.isTrial || streamer.planId === 'legend') {
      return res.status(400).json({ error: 'Already on a trial or premium plan' });
    }

    const email = streamer.email || req.user.email;

    // Check Multi-factor Identity Abuse
    const matchingTrial = await TrialRecordModel.findOne({
      $or: [
        { email: Boolean(email) ? email : 'never-match' },
        { ipAddress: Boolean(ipAddress) ? ipAddress : 'never-match' },
        { channelUrl: Boolean(channelUrl) ? channelUrl : 'never-match' }
      ]
    });

    if (matchingTrial) {
      let reason = 'Unknown identifier match';
      if (matchingTrial.email === email) reason = 'Email already used for trial.';
      else if (matchingTrial.ipAddress === ipAddress) reason = 'Device/IP already used for trial.';
      else if (matchingTrial.channelUrl === channelUrl) reason = 'Channel already claimed a trial.';

      // Record denial
      await TrialRecordModel.create({
        email, ipAddress, channelUrl, streamerId: streamer.id, denialReason: reason
      });

      return res.status(403).json({ 
        error: 'Trial Abuse Protection', 
        denialReason: reason,
        redirect: '/pricing'
      });
    }

    // Grant Trial
    streamer.isTrial = true;
    streamer.planId = 'legend'; 
    streamer.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await streamer.save();

    await TrialRecordModel.create({
       email, ipAddress, channelUrl, streamerId: streamer.id, denialReason: ''
    });

    res.json({ success: true, message: '14-day Legend trial granted.', streamer });
  }));

  // --- Widget Routes ---
  app.get('/api/widgets', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const widgets = await WidgetModel.find({ streamerId: req.user.uid });
    res.json(widgets);
  }));

  app.post('/api/widgets', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const widget = new WidgetModel({ ...req.body, streamerId: req.user.uid });
    await widget.save();
    res.json(widget);
  }));

  app.patch('/api/widgets/:id', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const updated = await WidgetModel.findOneAndUpdate(
      { _id: req.params.id, streamerId: req.user.uid },
      { $set: req.body },
      { new: true }
    );
    res.json(updated);
  }));

  app.delete('/api/widgets/:id', verifyAuth, asyncHandler(async (req: any, res: any) => {
    await WidgetModel.deleteOne({ _id: req.params.id, streamerId: req.user.uid });
    res.json({ success: true });
  }));

  // --- Donation Routes ---
  app.get('/api/donations', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const donations = await DonationModel.find({ streamerId: req.user.uid }).sort({ createdAt: -1 }).limit(100);
    
    // Calculate total verified earnings for authenticity
    const stats = await DonationModel.aggregate([
      { $match: { streamerId: req.user.uid, status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      donations,
      totalEarnings: stats[0]?.total || 0
    });
  }));

  app.post('/api/donations/:id/resend-tts', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const streamer = await StreamerModel.findOne(getStreamerQuery(req.user.uid));
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    // Streamers might be referenced by _id or firebaseUid in different records
    const streamerIds = [streamer._id.toString(), streamer.firebaseUid].filter(Boolean);

    const donation = await DonationModel.findOne({ 
      _id: req.params.id, 
      streamerId: { $in: streamerIds }
    });
    
    if (!donation) return res.status(404).json({ error: 'Donation not found' });
    if (donation.status !== 'verified') return res.status(400).json({ error: 'Only verified tips can trigger alerts' });

    const streamerData = await StreamerModel.findOne({ firebaseUid: donation.streamerId }) || 
                         await StreamerModel.findById(donation.streamerId);

    const displayAmount = donation.originalAmount || donation.amount;
    const displayCurrency = donation.originalCurrency || donation.currency;
    const currWord = (displayCurrency === 'INR' || displayCurrency === '₹') ? 'Rupees' : 
                     (displayCurrency === 'USD' || displayCurrency === '$') ? 'Dollars' : displayCurrency;
    
    const ttsText = `${donation.donorName} sent ${displayAmount} ${currWord}. ${donation.message}`.substring(0, 200);

    const widgets = await WidgetModel.find({ streamerId: donation.streamerId });
    
    await Promise.all(widgets.map(async (widget) => {
      let audioUrl = null;
      if (widget.type === 'alert' && widget.config?.ttsEnabled) {
         const rawLangCode = widget.config?.ttsVoice || 'en-IN';
         const langCode = rawLangCode.startsWith('celebrity-') ? 'en-US' : rawLangCode;
         const ttsHash = crypto.createHash('md5').update(ttsText + langCode).digest('hex');
         
         const existingTts = await TTSCacheModel.findOne({ textHash: ttsHash });
         if (existingTts) {
            audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
         } else {
            try {
               const base64Audio = await googleTts.getAudioBase64(ttsText, {
                 lang: langCode,
                 slow: false,
                 host: 'https://translate.google.com'
               });
               await TTSCacheModel.create({
                 textHash: ttsHash,
                 audioData: base64Audio,
                 expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
               });
               audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
            } catch (e: any) {
               console.error("Manual TTS generation failed:", e.message);
            }
         }
      }
      
      io.to(`widget:${widget._id}`).emit('overlay_alert_enqueue', {
        alertId: donation._id,
        donation,
        audioUrl
      });
    }));

    res.json({ success: true });
  }));

  app.post('/api/donations/:id/verify', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const streamer = await StreamerModel.findOne(getStreamerQuery(req.user.uid));
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    const donation = await DonationModel.findOne({ 
      _id: req.params.id, 
      streamerId: { $in: [streamer._id.toString(), streamer.firebaseUid] },
      status: 'pending'
    });

    if (!donation) return res.status(404).json({ error: 'Pending donation not found' });

    donation.status = 'verified';
    await donation.save();

    // Trigger alert immediately upon manual verification
    const displayAmount = donation.originalAmount || donation.amount;
    const displayCurrency = donation.originalCurrency || donation.currency;
    const currWord = (displayCurrency === 'INR' || displayCurrency === '₹') ? 'Rupees' : 
                     (displayCurrency === 'USD' || displayCurrency === '$') ? 'Dollars' : displayCurrency;
    
    const ttsText = `${donation.donorName} sent ${displayAmount} ${currWord}. ${donation.message}`.substring(0, 200);

    const widgets = await WidgetModel.find({ streamerId: donation.streamerId });
    
    await Promise.all(widgets.map(async (widget) => {
      let audioUrl = null;
      if (widget.type === 'alert' && widget.config?.ttsEnabled) {
         const rawLangCode = widget.config?.ttsVoice || 'en-IN';
         const langCode = rawLangCode.startsWith('celebrity-') ? 'en-US' : rawLangCode;
         const ttsHash = crypto.createHash('md5').update(ttsText + langCode).digest('hex');
         
         const existingTts = await TTSCacheModel.findOne({ textHash: ttsHash });
         if (existingTts) {
            audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
         } else {
            try {
               const base64Audio = await googleTts.getAudioBase64(ttsText, {
                 lang: langCode,
                 slow: false,
                 host: 'https://translate.google.com'
               });
               await TTSCacheModel.create({
                 textHash: ttsHash,
                 audioData: base64Audio,
                 expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
               });
               audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
            } catch (e: any) {
               console.error("Manual Verify TTS extraction failed:", e.message);
            }
         }
      }

      io.to(`widget:${widget._id}`).emit('overlay_alert_enqueue', {
        alertId: donation._id,
        donation,
        audioUrl
      });
    }));

    res.json({ success: true, donation });
  }));

  // --- Payment Routes ---
  app.post('/api/payment/razorpay/order', asyncHandler(async (req: any, res: any) => {
    const { streamerId, amount, currency } = req.body; 
    if (!streamerId || !amount) return res.status(400).json({ error: 'Missing fields' });

    const streamer = await StreamerModel.findOne({
      $or: [
        { _id: streamerId.length === 24 ? streamerId : null },
        { firebaseUid: streamerId }
      ]
    });
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    
    const razorpayGateway = streamer.gateways?.find((g: any) => g.type === 'razorpay');
    if (!razorpayGateway) return res.status(400).json({ error: 'Razorpay not configured' });
    
    const keyId = razorpayGateway.config.razorpayKeyId;
    const keySecret = streamer.secrets?.razorpayKeySecret;
    
    if (!keyId || !keySecret) return res.status(400).json({ error: 'Keys missing' });

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: currency === '₹' ? 'INR' : (currency || 'INR'),
      receipt: `rcpt_${Date.now()}`,
      notes: { streamerId: streamer.id, donorName: req.body.donorName || "Anonymous", message: req.body.message || "" }
    });
    
    res.json({ orderId: order.id, keyId, amount: order.amount, currency: order.currency });
  }));

  app.post('/api/payment/success', asyncHandler(async (req: any, res: any) => {
    const { 
      streamerId, donorName, donorImage, amount, currency, 
      originalAmount, originalCurrency, message, status, gateway, paymentId 
    } = req.body;
    
    if (!streamerId) return res.status(400).json({ error: 'Missing streamerId' });

    const streamer = await StreamerModel.findOne({ firebaseUid: streamerId });
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    const donation = new DonationModel({
      streamerId: streamerId,
      donorName: donorName || 'Anonymous',
      donorImage,
      message: message || '',
      amount: amount || 0,
      currency: currency || '₹',
      originalAmount: originalAmount || amount,
      originalCurrency: originalCurrency || currency,
      status: status || 'verified',
      gateway: gateway || 'unknown',
      paymentId
    });
    
    await donation.save();

    // Only trigger live alerts/TTS if verified immediately
    if (donation.status === 'verified') {
      io.to(`streamer:${streamerId}`).emit('payment_verified', {
        donation,
        planAccess: streamer.planId
      });

      const displayAmount = donation.originalAmount || donation.amount;
      const displayCurrency = donation.originalCurrency || donation.currency;
      const currWord = displayCurrency === 'INR' || displayCurrency === '₹' ? 'Rupees' : (displayCurrency === 'USD' || displayCurrency === '$' ? 'Dollars' : displayCurrency);
      const ttsText = `${donation.donorName} sent ${displayAmount} ${currWord}. ${donation.message}`.substring(0, 200);

      const widgets = await WidgetModel.find({ streamerId });
      
      for (const widget of widgets) {
         let audioUrl = null;
         if (widget.type === 'alert' && widget.config?.ttsEnabled) {
            const rawLangCode = widget.config?.ttsVoice || 'en-US';
            const langCode = rawLangCode.startsWith('celebrity-') ? 'en-US' : rawLangCode;
            const ttsHash = crypto.createHash('md5').update(ttsText + langCode).digest('hex');
            
            const existingTts = await TTSCacheModel.findOne({ textHash: ttsHash });
            if (existingTts) {
               audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
            } else {
               try {
                  const base64Audio = await googleTts.getAudioBase64(ttsText, {
                    lang: langCode,
                    slow: false,
                    host: 'https://translate.google.com'
                  });
                  await TTSCacheModel.create({
                    textHash: ttsHash,
                    audioData: base64Audio,
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
                  });
                  audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
               } catch (e: any) {
                  console.error("TTS generation failed:", e.message);
               }
            }
         }
         
         io.to(`widget:${widget._id}`).emit('overlay_alert_enqueue', {
           alertId: donation._id,
           donation,
           audioUrl
         });
      }
    }

    res.json({ success: true, donation });
  }));

  app.post('/api/webhooks/razorpay', asyncHandler(async (req: any, res: any) => {
    // Razorpay Webhook Endpoint
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    // We need to verify signature using the streamer's keySecret.
    // However, Razorpay webhooks only send payload, they don't say WHICH keySecret to use at the top level
    // unless all webhooks are routed to a single platform app.
    // Standard platform practice: we use process.env.RAZORPAY_WEBHOOK_SECRET for platform-level central webhooks,
    // or we fetch the streamer from the payload notes.

    const body = req.body;
    let streamerId = body?.payload?.payment?.entity?.notes?.streamerId;
    
    // Fallback to order if payment doesn't have it (rare, but possible)
    if (!streamerId) {
       streamerId = body?.payload?.order?.entity?.notes?.streamerId;
    }

    if (!streamerId) {
      // Unrecognized event lacking our note mapping
      return res.status(200).json({ status: "ignored", reason: "no streamerId in notes" });
    }

    const streamer = await StreamerModel.findById(streamerId);
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    
    const keySecret = streamer.secrets?.razorpayKeySecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!keySecret) return res.status(400).json({ error: 'Webhook secret missing' });

    const expectedSignature = crypto.createHmac('sha256', keySecret)
                                    .update(req.rawBody || JSON.stringify(body))
                                    .digest('hex');

    if (expectedSignature !== signature) {
      console.error(`Invalid webhook signature for streamer ${streamerId}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // signature valid, check idempotency
    const eventId = req.headers['x-razorpay-eventId'] || body.id || `evt_${Date.now()}`;
    
    try {
      const existingEvent = await WebhookEventModel.findOne({ eventId, provider: 'razorpay' });
      if (existingEvent) {
        return res.status(200).json({ status: "duplicate acknowledged" });
      }

      await WebhookEventModel.create({
        eventId,
        provider: 'razorpay',
        status: body.event
      });

      if (body.event === 'payment.captured' || body.event === 'order.paid') {
        const paymentEntity = body.payload.payment.entity;
        
        const donation = new DonationModel({
          streamerId,
          donorName: paymentEntity.notes?.donorName || 'Anonymous',
          message: paymentEntity.notes?.message || '',
          amount: paymentEntity.amount / 100,
          currency: paymentEntity.currency,
          originalAmount: paymentEntity.notes?.originalAmount ? parseFloat(paymentEntity.notes.originalAmount) : (paymentEntity.amount / 100),
          originalCurrency: paymentEntity.notes?.originalCurrency || paymentEntity.currency,
          status: 'verified',
          gateway: 'razorpay',
          paymentId: paymentEntity.id,
          orderId: paymentEntity.order_id
        });
        
        await donation.save();

        // Real-time Event Delivery via Sockets
        io.to(`streamer:${streamerId}`).emit('payment_verified', {
          donation,
          planAccess: streamer.planId
        });
        
        const displayAmount = donation.originalAmount || donation.amount;
        const displayCurrency = donation.originalCurrency || donation.currency;
        const currWord = (displayCurrency === 'INR' || displayCurrency === '₹') ? 'Rupees' : 
                         (displayCurrency === 'USD' || displayCurrency === '$') ? 'Dollars' : displayCurrency;
        
        const ttsText = `${donation.donorName} sent ${displayAmount} ${currWord}. ${donation.message}`.substring(0, 200);
        
        const widgets = await WidgetModel.find({ streamerId });
        
        await Promise.all(widgets.map(async (widget) => {
           let audioUrl = null;
           if (widget.type === 'alert' && widget.config?.ttsEnabled) {
              const rawLangCode = widget.config?.ttsVoice || 'en-IN';
              const langCode = rawLangCode.startsWith('celebrity-') ? 'en-US' : rawLangCode;
              const ttsHash = crypto.createHash('md5').update(ttsText + langCode).digest('hex');
              
              const existingTts = await TTSCacheModel.findOne({ textHash: ttsHash });
              if (existingTts) {
                 audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
              } else {
                 try {
                    const base64Audio = await googleTts.getAudioBase64(ttsText, {
                      lang: langCode,
                      slow: false,
                      host: 'https://translate.google.com'
                    });
                    
                    await TTSCacheModel.create({
                      textHash: ttsHash,
                      audioData: base64Audio,
                      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) 
                    });
                    
                    audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
                 } catch (ttsErr: any) {
                    console.error("Server TTS failure:", ttsErr.message);
                 }
              }
           }
           
           io.to(`widget:${widget._id}`).emit('overlay_alert_enqueue', {
             alertId: donation._id,
             donation,
             audioUrl
           });
        }));
      }
      res.status(200).json({ status: "processed" });
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(500).json({ error: 'Internal server error processing webhook' });
    }
  }));

  app.post('/api/tts/generate', asyncHandler(async (req: any, res: any) => {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    // In a real production app with ElevenLabs, you would call their API here using the 'voice' ID.
    // For this prototype, we're using google-tts-api which takes language codes.
    const rawLangCode = voice && voice.includes('-') ? voice : 'en-US';
    const langCode = rawLangCode.startsWith('celebrity-') ? 'en-US' : rawLangCode;

    try {
      const ttsHash = crypto.createHash('md5').update(text + langCode).digest('hex');
      let audioUrl = '';
      
      const existingTts = await TTSCacheModel.findOne({ textHash: ttsHash });
      if (existingTts) {
          audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
      } else {
          const base64Audio = await googleTts.getAudioBase64(text, {
            lang: langCode,
            slow: false,
            host: 'https://translate.google.com'
          });
          
          await TTSCacheModel.create({
            textHash: ttsHash,
            audioData: base64Audio,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
          });
          
          audioUrl = `/api/tts/asset/${ttsHash}.mp3`;
      }
      res.json({ audioUrl });
    } catch (err: any) {
      console.error("TTS generation error:", err.message);
      res.status(500).json({ error: 'Failed to generate TTS' });
    }
  }));

  app.get('/api/tts/asset/:hash.mp3', asyncHandler(async (req: any, res: any) => {
    const { hash } = req.params;
    const tts = await TTSCacheModel.findOne({ textHash: hash });
    
    if (!tts || !tts.audioData) {
      return res.status(404).send('Audio not found');
    }
    
    const audioBuffer = Buffer.from(tts.audioData, 'base64');
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    
    res.end(audioBuffer);
  }));

  // --- Admin Routes ---
  app.get('/api/admin/streamers', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const all = await StreamerModel.find({});
    res.json(all);
  }));

  app.get('/api/admin/settings', asyncHandler(async (req: any, res: any) => {
    const settings = await SettingsModel.findOne({ key: 'platform' });
    res.json(settings?.value || {});
  }));

  app.patch('/api/admin/settings', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const updated = await SettingsModel.findOneAndUpdate(
      { key: 'platform' },
      { $set: { value: req.body.value } },
      { new: true, upsert: true }
    );
    res.json(updated.value);
  }));

  app.get('/api/admin/plans', asyncHandler(async (req: any, res: any) => {
    const plans = await PlanModel.find({});
    res.json(plans);
  }));

  app.post('/api/admin/plans', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const plan = new PlanModel(req.body);
    await plan.save();
    res.status(201).json(plan);
  }));

  app.patch('/api/admin/plans/:id', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const updated = await PlanModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(updated);
  }));

  app.delete('/api/admin/plans/:id', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    await PlanModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  }));

  // --- Overlay Routes (Public) ---
  app.get('/api/public/exchange-rates', asyncHandler(async (req: any, res: any) => {
    try {
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      res.json(response.data);
    } catch (error) {
      console.error("Exchange rate fetch error:", error);
      res.json({ rates: { USD: 1, INR: 83, EUR: 0.92, GBP: 0.79 }, base: "USD" });
    }
  }));

  app.get('/api/public/widgets/:id', asyncHandler(async (req: any, res: any) => {
    const widget = await WidgetModel.findById(req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    res.json(widget);
  }));

  app.get('/api/public/overlays/:widgetId/donations', asyncHandler(async (req: any, res: any) => {
    const widget = await WidgetModel.findById(req.params.widgetId);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    const { since } = req.query;
    const queryCond: any = { 
      streamerId: widget.streamerId,
      status: 'verified'
    };
    
    // For goal/ticker widgets, only count donations made AFTER the widget was created
    // unless this is an alert widget which polls continuously using `since`
    if (widget.type !== 'alert') {
      queryCond.createdAt = { $gte: widget.createdAt };
    }
    
    if (since) {
      queryCond.createdAt = { ...queryCond.createdAt, $gt: new Date(since as string) };
    }

    const donations = await DonationModel.find(queryCond).sort({ createdAt: 1 });
    res.json(donations);
  }));

  // --- Subscription Review Routes ---
  app.post('/api/subscriptions/review', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const { planId, planName, transactionId, screenshotUrl, amount, billingCycle } = req.body;
    const streamer = await StreamerModel.findOne(getStreamerQuery(req.user.uid));
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    const request = new SubscriptionReviewRequestModel({
      streamerId: streamer.firebaseUid || streamer._id,
      streamerEmail: streamer.email,
      streamerName: streamer.displayName || streamer.username,
      planId,
      planName,
      transactionId,
      screenshotUrl,
      amount,
      billingCycle
    });

    await request.save();
    res.status(201).json(request);
  }));

  app.get('/api/subscriptions/review', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requests = await SubscriptionReviewRequestModel.find({ streamerId: req.user.uid }).sort({ createdAt: -1 });
    res.json(requests);
  }));

  app.get('/api/admin/subscriptions/review', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const requests = await SubscriptionReviewRequestModel.find({}).sort({ createdAt: -1 });
    res.json(requests);
  }));

  app.post('/api/streamer/fetch-branding', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const { youtube, twitch, kick } = req.body;
    let profileImage = null;
    let coverImage = null;

    try {
      if (youtube && (youtube.includes('youtube.com') || youtube.includes('youtu.be'))) {
         // Try oEmbed
         const ytRes = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtube)}&format=json`).catch(() => null);
         if (ytRes?.data?.thumbnail_url) {
            profileImage = ytRes.data.thumbnail_url;
         } 
         
         const handleMatch = youtube.match(/@([a-zA-Z0-9._-]+)/);
         if (handleMatch) {
            if (!profileImage) profileImage = `https://unavatar.io/youtube/${handleMatch[1]}`;
            coverImage = `https://unavatar.io/youtube/${handleMatch[1]}/banner`;
         } else if (youtube.includes('/channel/')) {
            const channelId = youtube.split('/channel/')[1]?.split('/')[0];
            if (channelId && !profileImage) profileImage = `https://unavatar.io/youtube/${channelId}`;
         }
      }
      if (twitch && twitch.includes('twitch.tv')) {
         const username = twitch.split('twitch.tv/')[1]?.split('/')?.[0]?.split('?')[0];
         if (username) {
            profileImage = `https://unavatar.io/twitch/${username}`;
            coverImage = `https://unavatar.io/twitch/${username}/banner`;
         }
      }
      if (kick && kick.includes('kick.com')) {
         const username = kick.split('kick.com/')[1]?.split('/')?.[0]?.split('?')[0];
         if (username) {
            profileImage = `https://unavatar.io/kick/${username}`;
         }
      }
    } catch (err) {}

    res.json({ profileImage, coverImage });
  }));

  app.patch('/api/admin/subscriptions/review/:id', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const requester = await StreamerModel.findOne({ firebaseUid: req.user.uid });
    if (requester?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { status } = req.body;
    const reviewRequest = await SubscriptionReviewRequestModel.findById(req.params.id);
    if (!reviewRequest) return res.status(404).json({ error: 'Request not found' });

    reviewRequest.status = status;
    reviewRequest.resolvedAt = new Date();
    await reviewRequest.save();

    if (status === 'approved') {
      const streamer = await StreamerModel.findOne({ 
        $or: [
          { _id: reviewRequest.streamerId.length === 24 ? reviewRequest.streamerId : null },
          { firebaseUid: reviewRequest.streamerId }
        ]
      });
      if (streamer) {
        const duration = reviewRequest.billingCycle === 'yearly' ? 365 : 30;
        const now = new Date();
        const isCurrentlyActive = streamer.subscriptionActive && streamer.subscriptionExpiry && streamer.subscriptionExpiry > now && streamer.planId !== 'standard';

        if (isCurrentlyActive) {
          // Add to Queue
          const queueItem = new SubscriptionQueueModel({
            streamerId: streamer.firebaseUid || streamer._id.toString(),
            planId: reviewRequest.planId,
            planName: reviewRequest.planName,
            billingCycle: reviewRequest.billingCycle || 'monthly',
            durationDays: duration,
            status: 'queued'
          });
          await queueItem.save();
        } else {
          // Activate Immediately
          streamer.planId = reviewRequest.planId;
          streamer.subscriptionActive = true;
          const currentExpiry = streamer.subscriptionExpiry && streamer.subscriptionExpiry > now 
            ? streamer.subscriptionExpiry 
            : now;
          streamer.subscriptionExpiry = new Date(currentExpiry.getTime() + duration * 24 * 60 * 60 * 1000);
          await streamer.save();
          
          // Also set activated in queue record if we wanted audit, but here we just update streamer
        }
      }
    }

    res.json(reviewRequest);
  }));

  // Subscription Queue Endpoints
  app.get('/api/me/subscription/queue', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const streamerId = req.user.uid;
    const queue = await SubscriptionQueueModel.find({ streamerId, status: 'queued' }).sort({ purchasedAt: 1 });
    res.json(queue);
  }));

  app.post('/api/me/subscription/activate-queued/:queueId', verifyAuth, asyncHandler(async (req: any, res: any) => {
    const streamerId = req.user.uid;
    const queueItem = await SubscriptionQueueModel.findOne({ _id: req.params.queueId, streamerId, status: 'queued' });
    if (!queueItem) return res.status(404).json({ error: 'Queued plan not found' });

    const streamer = await StreamerModel.findOne({ firebaseUid: streamerId });
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });

    // Activate immediately, overwriting current
    const now = new Date();
    streamer.planId = queueItem.planId;
    streamer.subscriptionActive = true;
    streamer.subscriptionExpiry = new Date(now.getTime() + queueItem.durationDays * 24 * 60 * 60 * 1000);
    await streamer.save();

    queueItem.status = 'active';
    queueItem.activatedAt = now;
    await queueItem.save();

    res.json({ message: 'Plan activated successfully', streamer });
  }));

  app.patch('/api/public/widgets/:id/positions', asyncHandler(async (req: any, res: any) => {
    const { elementPositions } = req.body;
    const widget = await WidgetModel.findById(req.params.id);
    if (!widget) return res.status(404).json({ error: 'Widget not found' });

    widget.config = { ...widget.config, elementPositions };
    await (widget as any).save();
    res.json(widget);
  }));

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("API Global Error:", err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      code: err.name || 'API_ERROR'
    });
  });

  // --- Twitch Auth ---
  console.log("Registering routes...");
  app.get('/api/auth/twitch/url', (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: 'Twitch Client ID not configured' });
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/twitch/callback`;
    const twitchUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user:read:email&state=${Math.random().toString(36).substring(7)}`;
    res.json({ url: twitchUrl });
  });

  app.get('/api/auth/twitch/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');
    try {
      const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/twitch/callback`
        }
      });
      const { access_token } = tokenResponse.data;
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${access_token}` }
      });
      const twitchUser = userResponse.data.data[0];
      let customToken = null;
      if (admin.apps.length) {
        customToken = await admin.auth().createCustomToken(`twitch:${twitchUser.id}`, { email: twitchUser.email });
      }
      res.send(`<html><body><script>
        window.opener.postMessage(${JSON.stringify({ type: 'OAUTH_AUTH_SUCCESS', provider: 'twitch', user: twitchUser, token: customToken })}, '*');
        window.close();
      </script></body></html>`);
    } catch (err: any) {
      res.status(500).send(`Auth failed: ${err.message}`);
    }
  });

  console.log("Configuring frontend serving...");
  if (process.env.NODE_ENV !== 'production') {
    console.log("Initializing Vite dev server...");
    const vite = await createViteServer({ 
      server: { middlewareMode: true }, 
      appType: 'spa' 
    });
    app.use(vite.middlewares);
    console.log("Vite middleware ready.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server fully operational on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical Server Startup Error:", err);
  process.exit(1);
});
