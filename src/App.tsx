import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import TipPage from './pages/TipPage';
import OverlayPage from './pages/OverlayPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import Navbar from './components/layout/Navbar';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen font-sans text-neutral-200 relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
        
        {/* ProTip Global Nebula Background */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#4F46E5] opacity-[0.15] blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#7C3AED] opacity-[0.15] blur-[100px]" />
        </div>

        <Toaster position="top-right" theme="dark" closeButton toastOptions={{ 
          className: 'glass-panel text-white border-white/10' 
        }} />
        
        <Routes>
          {/* Overlay routes don't show Navbar */}
          <Route path="/overlay/:widgetId" element={<OverlayPage />} />
          <Route path="/admindashboard/login" element={<AdminLoginPage />} />
          
          <Route path="*" element={
            <>
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admindashboard" element={<AdminDashboard />} />
                <Route path="/t/:username" element={<TipPage />} />
              </Routes>
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}
