import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, BookOpen, Users, MessageSquare, Bell, 
  Search, Calendar, Award, Clock, TrendingUp, User,
  FileText, CheckCircle, Download, Star, 
  MoreHorizontal, Upload, Settings, LogOut, ChevronRight, ChevronLeft, X, UserCircle, Camera, Phone,
  Palette, Globe, Info, MapPin, Instagram, Moon, Sun, Heart, MessageCircle, Share2, Send,
  Lightbulb, PenTool, Cpu, Rocket, Database, Zap, Shield, Plus, Edit2, Trash2, Lock, Bot
} from 'lucide-react';
import { getAiGreeting, getAiTips, getAiNews, brainstormInitiate, brainstormMessage } from './services/geminiService';
import { QRCodeCanvas } from 'qrcode.react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { legalContent } from './legal';
import ReactMarkdown from 'react-markdown';

// --- TYPES ---
interface Member {
  id: number;
  name: string;
  major: string;
  program: string;
  entryYear: number;
  gradYear?: number;
  role: string;
  wa?: string;
  nim?: string;
  photo?: string;
  username?: string;
  bio?: string;
}

interface ResearchDoc {
  id: number;
  title: string;
  category: string;
  author: string;
  year: number;
  downloads: number;
}

interface Announcement {
  id: number;
  project: string;
  roleNeeded: string;
  initiator: string;
  status: string;
  deadline: string;
  wa?: string;
}

interface Mentor {
  id: number;
  name: string;
  expertise: string;
  rating: number;
  available: boolean;
  experience?: string;
  education?: string;
  achievements?: string;
  photo?: string;
}

interface Banner {
  id: number;
  title: string;
  image: string;
}

interface Stat {
  id: number;
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
  sort_order: number;
}

interface Post {
  id: number;
  userId: number;
  content: string;
  likes: { userId: number, emoji: string }[];
  comments: any[];
  image?: string;
  poll?: { question: string, options: { text: string, votes: number }[] };
  note?: string;
  activityLabel?: string;
  createdAt: number;
  authorName: string;
  authorUsername: string;
  authorPhoto: string;
  authorRole: string;
}

interface Notification {
  id: number;
  userId: number;
  fromUserId: number;
  type: 'like' | 'comment';
  postId: number;
  content?: string;
  isRead: number;
  createdAt: number;
  fromUsername: string;
  fromPhoto: string;
}

interface NewsItem {
  title: string;
  category: string;
  summary: string;
}

// --- MOCK DATA (Fallback) ---
const iconMap: Record<string, any> = {
  TrendingUp, Users, BookOpen, Award
};

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeArticle, setActiveArticle] = useState<any>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [myProfile, setMyProfile] = useState<Member | null>(null);
  const [memberView, setMemberView] = useState('menu'); // menu, profile, list, card, settings
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [researchDocs, setResearchDocs] = useState<ResearchDoc[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [aiTips, setAiTips] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkHealth = () => {
      fetch('/api/health')
        .then(res => res.ok ? setServerStatus('online') : setServerStatus('offline'))
        .catch(() => setServerStatus('offline'));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);
  const [isPostingModalOpen, setIsPostingModalOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(true);

  // Settings State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('ukmpr_settings');
    if (saved) {
      try {
        return JSON.parse(saved).isDarkMode || false;
      } catch (e) {
        return false;
      }
    }
    return false; // Default to light mode if no saved preference
  });
  const [language, setLanguage] = useState('id');
  const [legalView, setLegalView] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      // If window height decreases significantly, assume keyboard is open
      if (window.visualViewport) {
        const isVisible = window.innerHeight - window.visualViewport.height > 150;
        setIsKeyboardVisible(isVisible);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  const [isAiLeaked, setIsAiLeaked] = useState(false);

  useEffect(() => {
    fetchData();
    const checkAiStatus = async () => {
      try {
        // Try a simple call to check key status
        await getAiGreeting();
      } catch (err: any) {
        if (err?.message?.includes("reported as leaked") || err?.message?.includes("403")) {
          setIsAiLeaked(true);
        }
      }
    };
    checkAiStatus();

    // Check for session
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(user => {
        if (user) {
          setMyProfile(user);
          if (user.role === 'Admin') setIsAdmin(true);
        }
      })
      .catch(err => console.error("Session check failed", err));

    // Fetch AI Content
    getAiTips().then(text => setAiTips(text));
    getAiNews().then(data => setNews(data));
    fetch('/api/posts').then(res => res.json()).then(data => setPosts(data));
    fetchNotifications();

    const savedSettings = localStorage.getItem('ukmpr_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setLanguage(settings.language || 'id');
    }
  }, []);

  const handleFixAi = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      window.location.reload();
    }
  };

  useEffect(() => {
    localStorage.setItem('ukmpr_settings', JSON.stringify({ isDarkMode, language }));
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode, language]);

  const openWhatsApp = (message: string) => {
    const phone = '6285738488594'; // Ganti dengan nomor WhatsApp tujuan
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };

  const fetchData = async () => {
    try {
      const [mRes, rRes, aRes, mentorRes, bannerRes, statRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/research'),
        fetch('/api/announcements'),
        fetch('/api/mentors'),
        fetch('/api/banners'),
        fetch('/api/stats')
      ]);
      
      if (!mRes.ok || !rRes.ok || !aRes.ok || !mentorRes.ok || !bannerRes.ok || !statRes.ok) {
        throw new Error("Gagal mengambil data dari server");
      }

      const mData = await mRes.json();
      const rData = await rRes.json();
      const aData = await aRes.json();
      const mentorData = await mentorRes.json();
      const bannerData = await bannerRes.json();
      const statData = await statRes.json();

      if (Array.isArray(mData)) setMembers(mData);
      if (Array.isArray(rData)) setResearchDocs(rData);
      if (Array.isArray(aData)) setAnnouncements(aData);
      if (Array.isArray(mentorData)) setMentors(mentorData);
      if (Array.isArray(bannerData)) setBanners(bannerData);
      if (Array.isArray(statData)) setStats(statData);
    } catch (err) {
      console.error("Failed to fetch data", err);
      // Optional: Add a toast or alert here if needed
    }
  };

  const renderContent = () => {
    if (activeArticle) return <ArticleDetailView article={activeArticle} onBack={() => setActiveArticle(null)} />;
    if (isAdmin && activeTab === 'admin') return <AdminView fetchData={fetchData} members={members} researchDocs={researchDocs} announcements={announcements} mentors={mentors} banners={banners} stats={stats} setIsAdmin={setIsAdmin} setMyProfile={setMyProfile} />;
    
    switch (activeTab) {
      case 'dashboard': return <DashboardView banners={banners} stats={stats} announcements={announcements} aiTips={aiTips} news={news} onNavigate={setActiveTab} onOpenArticle={setActiveArticle} openWhatsApp={openWhatsApp} isAdOpen={isAdOpen} setIsAdOpen={setIsAdOpen} isAiLeaked={isAiLeaked} handleFixAi={handleFixAi} isDarkMode={isDarkMode} />;
      case 'riset': return <RisetMenuView docs={researchDocs} fetchData={fetchData} mentors={mentors} openWhatsApp={openWhatsApp} myProfile={myProfile} isDarkMode={isDarkMode} />;
      case 'bursatim': return <BursaTimView requests={announcements} fetchData={fetchData} openWhatsApp={openWhatsApp} isDarkMode={isDarkMode} />;
      case 'feed': return <FeedView posts={posts} setPosts={setPosts} myProfile={myProfile} setMyProfile={setMyProfile} isPostingModalOpen={isPostingModalOpen} setIsPostingModalOpen={setIsPostingModalOpen} isDarkMode={isDarkMode} isKeyboardVisible={isKeyboardVisible} />;
      default: return <DashboardView banners={banners} stats={stats} announcements={announcements} aiTips={aiTips} news={news} onOpenArticle={setActiveArticle} openWhatsApp={openWhatsApp} isAdOpen={isAdOpen} setIsAdOpen={setIsAdOpen} isAiLeaked={isAiLeaked} handleFixAi={handleFixAi} isDarkMode={isDarkMode} />;
    }
  };

  // --- BOTTOM NAVIGATION ITEMS ---
  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Beranda' },
    { id: 'riset', icon: BookOpen, label: 'Riset' },
    { id: 'bursatim', icon: Users, label: 'Tim' },
    { id: 'feed', icon: MessageSquare, label: 'Feed' },
  ];
  
  if (isAdmin) {
    navItems.push({ id: 'admin', icon: Settings, label: 'Admin' });
  }

  const handleNavClick = (id: string) => {
  setActiveTab(id);
  setIsMoreMenuOpen(false);
  // Tambahkan baris ini untuk mencatat riwayat navigasi
  window.history.pushState({ tab: id }, '', `#${id}`);
};

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} flex justify-center font-sans selection:bg-blue-500 selection:bg-opacity-20 selection:text-blue-500 transition-colors duration-300`}>
      <div className={`w-full max-w-md ${isDarkMode ? 'bg-slate-800' : 'bg-white'} h-screen h-[100dvh] shadow-2xl relative flex flex-col overflow-hidden transition-colors duration-300`}>
        
        {/* TOP HEADER */}
        <header className={`${isDarkMode ? 'bg-slate-800 bg-opacity-90 border-slate-700' : 'bg-white bg-opacity-90 border-slate-100'} backdrop-blur-md border-b flex flex-col px-5 shrink-0 sticky top-0 z-30 pt-3 pb-2`}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 mr-1">
                <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/logo-iahn.png" alt="Logo IAHN" className="h-7 w-auto object-contain" referrerPolicy="no-referrer" />
                <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/Logo-ukmpr" alt="Logo UKMPR" className="h-7 w-auto object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex flex-col">
                <span className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>UKMPR<span className="text-blue-600 dark:text-blue-400"> Hub</span></span>
                <span className="text-[9px] text-slate-500 font-medium -mt-1">Apps UKMPR IAHN Gde Pudja Mataram</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {myProfile && (
                <button 
                  onClick={() => {
                    setIsNotificationOpen(true);
                    markNotificationsRead();
                  }}
                  className={`relative p-2 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 animate-pulse">
                      {notifications.filter(n => !n.isRead).length}
                    </span>
                  )}
                </button>
              )}
              <button 
                onClick={() => { setIsMoreMenuOpen(true); setMemberView('settings'); }}
                className="relative p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-full hover:bg-slate-50"
              >
                <Settings size={20} />
              </button>
              {/* Server Status Dot */}
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === 'online' ? 'bg-green-500 animate-pulse' : 
                serverStatus === 'offline' ? 'bg-red-500' : 
                'bg-slate-400'
              }`} title={`Server: ${serverStatus}`} />
            </div>
          </div>
          
          {/* Header Running Text */}
          <div className="mt-2 overflow-hidden bg-slate-50 dark:bg-slate-900 dark:bg-opacity-50 py-1 border-y border-slate-100 dark:border-slate-700 -mx-5">
            <div className="flex w-max animate-marquee whitespace-nowrap">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 px-4">
                Telah terlaksana lomba resensi buku dan penyerahan hadiah • Selamat menunaikan ibadah puasa • Hari raya Nyepi sebentar lagi ada ogoh-ogoh • Gde Pudja Creativity Fair 16-17 Mei 2026 (Lomba KTI Nasional, Esai dan Video Pendek SMA/SMK Kota Mataram) • UKMPR IAHN Gde Pudja Mataram #BernalarCerdas
              </span>
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 px-4">
                Telah terlaksana lomba resensi buku dan penyerahan hadiah • Selamat menunaikan ibadah puasa • Hari raya Nyepi sebentar lagi ada ogoh-ogoh • Gde Pudja Creativity Fair 16-17 Mei 2026 (Lomba KTI Nasional, Esai dan Video Pendek SMA/SMK Kota Mataram) • UKMPR IAHN Gde Pudja Mataram #BernalarCerdas
              </span>
            </div>
          </div>
        </header>

        {/* NOTIFICATION MODAL */}
        {isNotificationOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-300 max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                  <Bell size={20} className="mr-2 text-blue-600" />
                  Notifikasi
                </h3>
                <button onClick={() => setIsNotificationOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Bell size={40} className="mb-3 opacity-20" />
                    <p className="text-sm">Belum ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-3 rounded-2xl flex items-start space-x-3 transition-all duration-300 ${n.isRead ? 'bg-slate-50 dark:bg-slate-900/40' : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'}`}
                    >
                      <img src={n.fromPhoto || 'https://picsum.photos/seed/user/100/100'} alt={n.fromUsername} className="h-10 w-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-snug">
                          <span className="font-bold">@{n.fromUsername}</span> {n.type === 'like' ? 'menyukai postingan Anda' : 'mengomentari postingan Anda'}
                        </p>
                        {n.content && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 italic">"{n.content}"</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center">
                          <Clock size={10} className="mr-1" />
                          {new Date(n.createdAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={() => setIsNotificationOpen(false)}
                className="w-full mt-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* MAIN SCROLLABLE CONTENT */}
        <main className={`flex-1 overflow-y-auto pb-48 pt-4 px-4 ${isDarkMode ? 'bg-slate-900 bg-opacity-50' : 'bg-slate-50 bg-opacity-50'} transition-colors duration-300`}>
          {renderContent()}
        </main>

        {/* BOTTOM NAVIGATION */}
        {!isPostingModalOpen && !isKeyboardVisible && (
          <>
            {/* Navigation Fade Background */}
            <div className={`fixed bottom-0 left-0 right-0 h-32 pointer-events-none z-[55] bg-gradient-to-t ${isDarkMode ? 'from-slate-900 via-slate-900/80 to-transparent' : 'from-slate-50 via-slate-50/80 to-transparent'}`} />
            
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] left-0 right-0 flex justify-center px-4 z-[60] pointer-events-none">
              <nav className={`w-full max-w-[calc(100%-1rem)] md:max-w-md ${isDarkMode ? 'bg-slate-800/95 border-slate-700 shadow-blue-900/20' : 'bg-white/95 border-slate-200 shadow-slate-200/50'} backdrop-blur-xl border flex justify-around items-center px-2 py-2.5 rounded-3xl shadow-2xl pointer-events-auto transition-all duration-300`}>
              {navItems.map((item) => {
                const isActive = activeTab === item.id && !isMoreMenuOpen;
                const IconComponent = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`flex flex-col items-center justify-center w-16 space-y-1 transition-all duration-300 ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-50' : 'bg-transparent'}`}>
                      <IconComponent size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
              
              {/* Menu Member */}
              <button
                onClick={() => { setIsMoreMenuOpen(true); setMemberView('menu'); }}
                className={`flex flex-col items-center justify-center w-16 space-y-1 transition-all duration-300 ${
                  isMoreMenuOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isMoreMenuOpen ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-50' : 'bg-transparent'}`}>
                  <UserCircle size={isMoreMenuOpen ? 22 : 20} strokeWidth={isMoreMenuOpen ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-medium ${isMoreMenuOpen ? 'font-bold' : ''}`}>
                  Member
                </span>
              </button>
            </nav>
          </div>
          </>
        )}

        {/* FULLSCREEN MENU */}
        {isMoreMenuOpen && (
          <div className={`absolute inset-0 z-50 ${isDarkMode ? 'bg-slate-900' : 'bg-white'} flex flex-col transition-all duration-300 pb-24`}>
            {/* Header for Fullscreen Menu */}
            <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center">
                {memberView !== 'menu' && (
                  <button 
                    onClick={() => setMemberView('menu')} 
                    className={`mr-3 p-1 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {memberView === 'menu' ? 'Member Area' : 
                   memberView === 'settings' ? 'Pengaturan' : 
                   memberView === 'profile' ? (myProfile ? 'Edit Profil ID' : 'Isi Profil ID') : 
                   memberView === 'feed-profile' ? 'Profil Feed' : 
                   `Daftar ${listFilter || 'Member'}`}
                </h3>
              </div>
              <button 
                onClick={() => setIsMoreMenuOpen(false)}
                className={`p-2 rounded-full ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {memberView === 'menu' && (
                <>
                  {/* Removed duplicate settings/logout buttons from here */}
                  
                  {myProfile && !isAdmin && (
                    <div className="mb-6 flex flex-col items-center">
                        <div 
                          id="member-card-download-area"
                          className={`w-full max-w-sm rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden flex flex-col bg-gradient-to-br from-sky-500 to-blue-900`}
                        >
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white bg-opacity-10 rounded-full filter blur-xl opacity-50"></div>
                        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-white bg-opacity-10 rounded-full filter blur-xl opacity-50"></div>
                        
                        <div className="flex items-center w-full space-x-4 mb-4">
                          <img 
                            src={myProfile.photo} 
                            alt="Profile" 
                            className="w-24 h-24 rounded-2xl object-cover border-4 border-white border-opacity-20 shadow-lg"
                          />
                          <div className="bg-white p-1.5 rounded-lg">
                             <QRCodeCanvas value={`https://wa.me/${myProfile.wa?.replace(/\D/g, '')}`} size={72} />
                          </div>
                        </div>

                        <div className="w-full text-left">
                          <h3 className="text-2xl font-bold tracking-tight uppercase">{myProfile.name}</h3>
                          <p className="text-sm font-medium text-white text-opacity-80 tracking-widest mb-3">{myProfile.nim}</p>
                        </div>
                        
                        <div className={`self-stretch border-t border-white border-opacity-20 my-3`}></div>

                        <div className="w-full text-left text-xs space-y-2">
                          <div className="flex items-center">
                            <BookOpen size={14} className="mr-3 opacity-70" />
                            <span>{myProfile.program} {myProfile.major}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-3 opacity-70" />
                            <span>Angkatan {myProfile.entryYear}</span>
                          </div>
                           <div className="flex items-center">
                            <Phone size={14} className="mr-3 opacity-70" />
                            <span>{myProfile.wa}</span>
                          </div>
                        </div>

                        <div className={`self-stretch border-t border-white border-opacity-20 my-3`}></div>

                        <div className="flex justify-between items-center w-full">
                           <div className="text-left">
                            <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase">UKMPR Hub</p>
                            <p className="text-[10px] font-bold opacity-50">IAHN Gde Pudja Mataram</p>
                          </div>
                          <div className="bg-blue-900 bg-opacity-30 backdrop-blur-md px-3 py-1 rounded-xl border border-white border-opacity-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest">{myProfile.role}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button onClick={() => setMemberView('profile')} className={`flex flex-col items-center justify-center p-4 ${isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-blue-600'} rounded-2xl hover:bg-blue-100 dark:hover:bg-slate-600 transition-colors`}>
                      <UserCircle size={24} className="mb-2" />
                      <span className="text-xs font-bold">{myProfile ? 'Edit Profil ID' : 'Profile ID'}</span>
                    </button>
                    <button onClick={() => setMemberView('feed-profile')} className={`flex flex-col items-center justify-center p-4 ${isDarkMode ? 'bg-slate-700 text-purple-400' : 'bg-purple-50 text-purple-600'} rounded-2xl hover:bg-purple-100 dark:hover:bg-slate-600 transition-colors`}>
                      <MessageSquare size={24} className="mb-2" />
                      <span className="text-xs font-bold">Profil Feed</span>
                    </button>
                    <button onClick={() => { setListFilter('Anggota'); setMemberView('list'); }} className={`flex flex-col items-center justify-center p-4 ${isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-blue-600'} rounded-2xl hover:bg-blue-100 transition-colors`}>
                      <Users size={24} className="mb-2" />
                      <span className="text-xs font-bold">Anggota Aktif</span>
                    </button>
                    <button onClick={() => { setListFilter('Alumni'); setMemberView('list'); }} className={`flex flex-col items-center justify-center p-4 ${isDarkMode ? 'bg-slate-700 text-orange-400' : 'bg-orange-50 text-orange-600'} rounded-2xl hover:bg-orange-100 transition-colors`}>
                      <Award size={24} className="mb-2" />
                      <span className="text-xs font-bold">Alumni</span>
                    </button>
                    <button onClick={() => { setListFilter('Pengurus'); setMemberView('list'); }} className={`flex flex-col items-center justify-center p-4 ${isDarkMode ? 'bg-slate-700 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} rounded-2xl hover:bg-emerald-100 transition-colors`}>
                      <Star size={24} className="mb-2" />
                      <span className="text-xs font-bold">Pengurus</span>
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setIsAdmin(false);
                          setMyProfile(null);
                          localStorage.removeItem('ukmpr_profile');
                          setMemberView('menu');
                        }} 
                        className={`flex flex-col items-center justify-center p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors`}
                      >
                        <LogOut size={24} className="mb-2" />
                        <span className="text-xs font-bold">Logout Admin</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {legalView && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                  <button onClick={() => setLegalView(null)} className="mb-4 flex items-center text-sm font-bold text-slate-500 hover:text-blue-600">
                    <ChevronLeft size={16} className="mr-1" /> Kembali ke Pengaturan
                  </button>
                  <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {legalContent[legalView as keyof typeof legalContent]}
                  </div>
                </div>
              )}

              {memberView === 'settings' && !legalView && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                      <Info size={14} className="mr-1.5" /> Informasi & Bantuan
                    </h4>
                    <div className="space-y-2">
                      {['dataSecurity', 'privacyPolicy', 'appGuidelines', 'termsOfService'].map(key => (
                        <button 
                          key={key}
                          onClick={() => setLegalView(key)}
                          className="w-full text-left flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600"
                        >
                          <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </span>
                          <ChevronRight size={16} className="text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dark Mode & Language */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Mode</h4>
                      <button 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="flex items-center space-x-2 font-bold text-sm"
                      >
                        {isDarkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-blue-600" />}
                        <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                      </button>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Bahasa</h4>
                      <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-transparent font-bold text-sm outline-none w-full"
                      >
                        <option value="id">Indonesia</option>
                        <option value="en">English</option>
                        <option value="bali">Bali</option>
                      </select>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Butuh Bantuan?</h4>
                    <button 
                      onClick={() => openWhatsApp('Halo, saya butuh bantuan terkait aplikasi UKMPR Hub.')}
                      className="flex items-center space-x-2 font-bold text-sm text-emerald-600 dark:text-emerald-400"
                    >
                      <MessageSquare size={18} />
                      <span>Pusat Bantuan</span>
                    </button>
                  </div>

                  {/* Admin Login Button */}
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Akses Khusus</h4>
                    <button 
                      onClick={() => setMemberView('adminLogin')}
                      className="flex items-center space-x-2 font-bold text-sm text-blue-600 dark:text-blue-400"
                    >
                      <Shield size={18} />
                      <span>Login Admin</span>
                    </button>
                  </div>

                  {/* About Section */}
                  <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'} space-y-4`}>
                    <div className="flex justify-start space-x-4 mb-2">
                      <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/logo-iahn.png" alt="Logo IAHN" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
                      <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/Logo-ukmpr" alt="Logo UKMPR" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                      <Info size={14} className="mr-1.5" /> Tentang Aplikasi
                    </h4>
                    <div className="space-y-2 text-xs">
                      <p className="flex items-center text-slate-500 dark:text-slate-400">
                        <span className="font-bold mr-1">© 2024 UKMPR Hub.</span> All rights reserved.
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">Dev by <span className="font-bold text-blue-600 dark:text-blue-400">UKMPR IAHN Gde Pudja Mataram</span></p>
                      <a href="https://instagram.com/dharmayanggg" target="_blank" className="flex items-center text-blue-600 dark:text-blue-400 font-bold hover:underline">
                        <Instagram size={14} className="mr-1.5" /> design & licensed by @dharmayanggg
                      </a>
                      <a href="https://maps.google.com/?q=IAHN+Gde+Pudja+Mataram" target="_blank" className="flex items-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <MapPin size={14} className="mr-1.5" /> Kampus IAHN Gde Pudja Mataram
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {memberView === 'feed-profile' && myProfile && (
                <FeedProfileEdit myProfile={myProfile} setMyProfile={setMyProfile} isDarkMode={isDarkMode} />
              )}

              {memberView === 'profile' && (
                <div>
                  {myProfile ? (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const name = formData.get('name') as string;
                      const nim = formData.get('nim') as string;

                      if (name === 'admin1' && nim === 'adminku') {
                        setIsAdmin(true);
                        setMyProfile({ name, nim, role: 'Admin', id: 0, major: 'Admin', program: 'Admin', entryYear: 2024 } as any);
                        localStorage.setItem('ukmpr_profile', JSON.stringify({ name, nim, role: 'Admin' }));
                        setMemberView('menu');
                        return;
                      }

                      const newProfile = {
                        name,
                        major: formData.get('major'),
                        program: formData.get('program'),
                        entryYear: parseInt(formData.get('entryYear') as string) || new Date().getFullYear(),
                        gradYear: formData.get('gradYear') ? parseInt(formData.get('gradYear') as string) : null,
                        role: formData.get('role'),
                        wa: formData.get('wa'),
                        nim,
                        photo: (document.getElementById('profile-preview') as HTMLImageElement).src
                      };
                      
                      const res = await fetch(`/api/profile/me`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newProfile)
                      });
                      
                      if (res.ok) {
                        const { user } = await res.json();
                        setMyProfile(user); // Use updated user from server response
                        fetchData();
                        setMemberView('menu');
                      }
                    }} className="space-y-3">
                      <div className="flex flex-col items-center mb-4">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-blue-500 border-opacity-20 shadow-inner group">
                          <img 
                            src={myProfile?.photo || "https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff"} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            id="profile-preview"
                          />
                          <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera size={24} className="text-white" />
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64 = reader.result as string;
                                    (document.getElementById('profile-preview') as HTMLImageElement).src = base64;
                                    
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                        
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Klik foto untuk ganti</p>
                      </div>

                      <input name="name" defaultValue={myProfile?.name} required placeholder="Nama Lengkap" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                      <input name="nim" defaultValue={myProfile?.nim} required placeholder="NIM" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                      
                      <div className="space-y-3 mt-3">
                        <input name="wa" defaultValue={myProfile?.wa} placeholder="No. WhatsApp" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                        <input name="major" defaultValue={myProfile?.major} placeholder="Jurusan" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                        <input name="program" defaultValue={myProfile?.program} placeholder="Program Studi" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                        <div className="flex space-x-2">
                          <input name="entryYear" defaultValue={myProfile?.entryYear} required type="number" placeholder="Tahun Masuk" className={`w-1/2 p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                          <input name="gradYear" defaultValue={myProfile?.gradYear || ''} type="number" placeholder="Tahun Lulus" className={`w-1/2 p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                        </div>
                        <select name="role" defaultValue={myProfile?.role || ''} className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}>
                          <option value="">Pilih Status</option>
                          <option value="Anggota">Anggota Aktif</option>
                          <option value="Pengurus">Pengurus</option>
                          <option value="Alumni">Alumni</option>
                        </select>
                      </div>

                      <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2 hover:bg-blue-700 transition-colors">
                        Simpan Profil
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-6 py-10">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <UserCircle size={48} className="text-slate-400" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Login Member</h3>
                        <p className="text-sm text-slate-500 max-w-[250px]">Masuk dengan akun Google untuk mengakses fitur member area.</p>
                      </div>
                      
                      <div className="w-full max-w-xs space-y-4">
                        {/* Tab Switcher */}
                        <div className="flex border-b border-slate-200 mb-4">
                          <button 
                            className={`flex-1 py-2 text-sm font-bold ${!isRegistering ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                            onClick={() => { setIsRegistering(false); setAuthError(''); }}
                          >
                            Masuk
                          </button>
                          <button 
                            className={`flex-1 py-2 text-sm font-bold ${isRegistering ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}
                            onClick={() => { setIsRegistering(true); setAuthError(''); }}
                          >
                            Daftar
                          </button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setAuthError('');
                            const fd = new FormData(e.currentTarget);
                            const data = Object.fromEntries(fd.entries());

                            const url = isRegistering ? '/api/auth/public-register' : '/api/auth/login';
                            
                            try {
                                const res = await fetch(url, {
                                    method: 'POST',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(data)
                                });

                                const result = await res.json();

                                if (res.ok && result.success) {
                                    setMyProfile(result.user);
                                    if (result.user?.role === 'Admin') {
                                        setIsAdmin(true);
                                    }
                                    setMemberView('menu');
                                    setIsMoreMenuOpen(false);
                                } else {
                                    setAuthError(result.error || 'Terjadi kesalahan');
                                }
                            } catch (err) {
                                setAuthError('Tidak dapat terhubung ke server.');
                            }
                        }} className="space-y-3">
                            {isRegistering && (
                            <>
                                <input name="name" type="text" placeholder="Nama Lengkap" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                <div className="grid grid-cols-2 gap-2">
                                <input name="major" type="text" placeholder="Jurusan" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                <input name="program" type="text" placeholder="Prodi" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                </div>
                                <input name="entryYear" type="number" placeholder="Tahun Angkatan" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                <div className="grid grid-cols-2 gap-2">
                                <input name="nim" type="text" placeholder="NIM" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                <input name="wa" type="text" placeholder="No. WhatsApp" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                                </div>
                            </>
                            )}
                            <input name="username" type="text" placeholder="Username" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                            <input name="password" type="password" placeholder="Password" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                            {isRegistering && <p className="text-[10px] text-slate-400 px-2 -mt-2">Minimal 6 karakter, dengan huruf besar, angka & simbol.</p>}
                            
                            {authError && <p className={`text-xs text-red-500 text-center ${isDarkMode ? 'bg-red-900/20' : 'bg-red-50'} p-2 rounded-lg`}>{authError}</p>}

                            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors">
                                {isRegistering ? 'Daftar & Masuk' : 'Masuk'}
                            </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {memberView === 'adminLogin' && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10">
                  <div className="w-20 h-20 bg-blue-600 bg-opacity-10 rounded-full flex items-center justify-center mb-2">
                    <Shield size={48} className="text-blue-600" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Login Administrator</h3>
                    <p className="text-sm text-slate-500 max-w-[250px]">Gunakan akun khusus admin untuk mengelola konten aplikasi.</p>
                  </div>
                  
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const data = Object.fromEntries(fd.entries());

                    try {
                      const res = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                      });
                      const json = await res.json();
                      if (json.error) {
                        alert(json.error);
                      } else {
                        if (json.user.role !== 'Admin') {
                          alert('Akun ini bukan administrator!');
                          return;
                        }
                        setMyProfile(json.user);
                        setIsAdmin(true);
                        setMemberView('menu');
                      }
                    } catch (err) {
                      alert('Gagal login admin');
                    }
                  }} className="w-full max-w-xs space-y-3">
                    <input name="username" required placeholder="Admin Username" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                    <input name="password" type="password" required placeholder="Admin Password" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500">
                      Masuk Dashboard
                    </button>
                    <button type="button" onClick={() => setMemberView('settings')} className="w-full text-slate-400 text-xs font-bold py-2">
                      Kembali ke Pengaturan
                    </button>
                  </form>
                </div>
              )}

              {/* The card view has been integrated into the main member menu */}

              {memberView === 'list' && (
                <div>
                  <div className="space-y-3">
                    {members.filter(m => m.role === listFilter).map(m => (
                      <div key={m.id} className="p-3 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center space-x-3 bg-white dark:bg-slate-800">
                        <div className="w-10 h-10 bg-blue-600 bg-opacity-10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{m.program} {m.major} ({m.entryYear})</p>
                        </div>
                      </div>
                    ))}
                    {members.filter(m => m.role === listFilter).length === 0 && (
                      <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">Belum ada data.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- SUB VIEWS ---

function DashboardView({ banners, stats, announcements, aiTips, news, onNavigate, onOpenArticle, openWhatsApp, isAdOpen, setIsAdOpen, isAiLeaked, handleFixAi, isDarkMode }: any) {
  // Infinite Banner Slider Logic
  const [currentBanner, setCurrentBanner] = useState(0);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [selectedStatDetails, setSelectedStatDetails] = useState<any>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const displayBanners = banners.length > 0 ? banners : [
    { id: 1, image: "https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner1.png", title: "Banner 1" },
    { id: 2, image: "https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner2.png", title: "Banner 2" },
    { id: 3, image: "https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/banner3.png", title: "Banner 3" },
  ];
  
  useEffect(() => {
    if (displayBanners.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % displayBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [displayBanners]);

  const [selectedBanner, setSelectedBanner] = useState<any>(null);

  const miniBanners = [
    { 
      title: "Selamat Menunaikan Ibadah Puasa", 
      subtitle: "Ramadhan Kareem 1447H", 
      color: "bg-emerald-500", 
      accent: "bg-emerald-600",
      textAccent: "text-emerald-600",
      emoji: "🌙",
      hasAction: false,
      description: "Segenap keluarga besar UKMPR IAHN Gde Pudja Mataram mengucapkan selamat menunaikan ibadah puasa 1447H bagi seluruh umat Muslim. Semoga bulan suci ini membawa keberkahan dan kedamaian bagi kita semua."
    },
    { 
      title: "NGOPI (Ngobrol Pintar)", 
      subtitle: "Diskusi Riset Santai & Asyik", 
      color: "bg-amber-500", 
      accent: "bg-amber-600",
      textAccent: "text-amber-600",
      emoji: "☕",
      hasAction: true,
      description: "NGOPI adalah wadah diskusi santai untuk membahas ide-ide riset, tips penulisan KTI, hingga sharing pengalaman lomba. Yuk, asah nalar kritis sambil ngopi bareng sobat riset lainnya!"
    },
    { 
      title: "Gabung UKMPR IAHN Gde Pudja", 
      subtitle: "#BernalarCerdas Bersama Kami", 
      color: "bg-blue-600", 
      accent: "bg-blue-700",
      textAccent: "text-blue-600",
      emoji: "🚀",
      hasAction: true,
      description: "Ingin jago menulis KTI, esai, atau ikut lomba nasional? Bergabunglah dengan UKMPR! Di sini kamu akan mendapatkan bimbingan intensif, networking luas, dan lingkungan yang mendukung kreativitasmu."
    },
  ];

  const galleryImages = [
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/creativity-mainposter.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/LKTIN-poster.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/esai-poster.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/video-poster.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/dokumentasi-resensi.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/resensi-1.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/resensi-2.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/resensi-3.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/resensi-main.webp',
    'https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/ucapan-dies.webp',
  ];

  const marqueeRiset = [
    { text: "Metodologi Riset", icon: Search },
    { text: "Analisis Data", icon: Database },
    { text: "Karya Tulis Ilmiah", icon: PenTool },
    { text: "Inovasi Teknologi", icon: Cpu },
    { text: "Publikasi Jurnal", icon: BookOpen },
    { text: "Seminar Nasional", icon: Users },
    { text: "Hibah Penelitian", icon: Award },
    { text: "Etika Penelitian", icon: Info },
  ];

  const marqueeFilsafat = [
    { text: "Ontologi", icon: Lightbulb },
    { text: "Epistemologi", icon: Search },
    { text: "Aksiologi", icon: Heart },
    { text: "Logika", icon: Cpu },
    { text: "Metafisika", icon: Zap },
    { text: "Etika", icon: Shield },
    { text: "Estetika", icon: Palette },
    { text: "Kebenaran Ilmiah", icon: CheckCircle },
  ];

  const handleStatClick = async (stat: any) => {
    try {
      const res = await fetch(`/api/stats/${stat.id}/details`);
      const data = await res.json();
      setSelectedStatDetails(data);
    } catch (err) {
      console.error("Failed to fetch stat details", err);
    }
  };

  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? setServerStatus('online') : setServerStatus('offline'))
      .catch(() => setServerStatus('offline'));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* 1. Simple Greeting (Text Only) */}
      <div className="px-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Hai, Sobat Riset! 👋</h1>
        <p className="text-sm text-slate-500 font-medium">
          Bareng UKMPR, kita <span className="text-blue-600 dark:text-blue-400 font-bold">#BernalarCerdas</span>
        </p>
      </div>

      {/* 4. Infinite Slide Banner */}
      {displayBanners.length > 0 ? (
        <div 
          className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => setSelectedGalleryImage(displayBanners[currentBanner].image)}
        >
          <div 
            className="flex transition-transform duration-700 ease-in-out h-full" 
            style={{ transform: `translateX(-${currentBanner * 100}%)` }}
          >
            {displayBanners.map((b: any, i: number) => (
              <div key={i} className="min-w-full h-full relative">
                <img src={b.image} alt={b.title} className="w-full h-full object-contain bg-slate-50 dark:bg-slate-900" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
          Belum ada banner
        </div>
      )}

      {/* 2. Mini Banner Cards (Portrait 4:5, Swipeable, Uniform Size) */}
      <div className="flex overflow-x-auto snap-x snap-mandatory space-x-4 pb-2 scrollbar-hide px-1">
        {miniBanners.map((mb, i) => (
          <div 
            key={i} 
            onClick={() => setSelectedBanner(mb)}
            className={`snap-center shrink-0 w-44 aspect-[4/5] ${mb.color} rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group active:scale-95 transition-transform cursor-pointer`}
          >
            {/* Decorative Background Elements */}
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white bg-opacity-20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <div className="relative z-10">
              <div className={`w-12 h-12 ${mb.accent} bg-opacity-80 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl mb-4 shadow-inner`}>
                {mb.emoji}
              </div>
              <h4 className="text-white font-bold text-base leading-tight mb-2 tracking-tight line-clamp-3">{mb.title}</h4>
              <p className="text-white text-opacity-80 text-[10px] leading-relaxed font-medium line-clamp-3">{mb.subtitle}</p>
            </div>

            <div className="relative z-10 flex justify-end">
              <div className={`p-2 ${mb.accent} bg-opacity-80 rounded-lg backdrop-blur-sm`}>
                <ChevronRight size={14} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Banner Info Modal */}
      {selectedBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className={`w-12 h-12 ${selectedBanner.color} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
                {selectedBanner.emoji}
              </div>
              <button onClick={() => setSelectedBanner(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{selectedBanner.title}</h3>
            <p className={`${selectedBanner.textAccent} text-xs font-bold mb-4 uppercase tracking-wider`}>{selectedBanner.subtitle}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
              {selectedBanner.description}
            </p>
            
            <div className="space-y-3">
              {selectedBanner.hasAction && (
                <button 
                  onClick={() => openWhatsApp(`Halo, saya tertarik untuk mendaftar event: ${selectedBanner.title}. Mohon informasinya.`)}
                  className={`w-full py-3 ${selectedBanner.color} text-white font-bold rounded-xl shadow-lg flex items-center justify-center`}
                >
                  Daftar Sekarang <Rocket size={16} className="ml-2" />
                </button>
              )}
              <button 
                onClick={() => setSelectedBanner(null)}
                className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Marquee Logo (2 Rows) */}
      <div className="space-y-2 overflow-hidden py-2 -mx-4">
        {/* Row 1: Riset (Left) */}
        <div className="flex w-max animate-marquee whitespace-nowrap">
          {[...marqueeRiset, ...marqueeRiset].map((item, i) => (
            <div key={`r1-${i}`} className="inline-flex items-center space-x-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-30 hover:border-blue-200 active:text-blue-600 active:border-blue-300 transition-colors group mx-1.5">
              <item.icon size={14} className="text-slate-400 group-hover:text-blue-500 group-active:text-blue-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-blue-600 group-active:text-blue-600">{item.text}</span>
            </div>
          ))}
        </div>
        {/* Row 2: Filsafat (Right - Reverse) */}
        <div className="flex w-max animate-marquee-reverse whitespace-nowrap">
          {[...marqueeFilsafat, ...marqueeFilsafat].map((item, i) => (
            <div key={`r2-${i}`} className="inline-flex items-center space-x-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900 dark:hover:bg-opacity-30 hover:border-purple-200 active:text-purple-600 active:border-purple-300 transition-colors group mx-1.5">
              <item.icon size={14} className="text-slate-400 group-hover:text-purple-500 group-active:text-purple-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 group-hover:text-purple-600 group-active:text-purple-600">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid (2 Columns, Clickable) */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Statistik UKMPR 📊</h2>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat: any) => {
            const Icon = iconMap[stat.icon] || Award;
            return (
              <div 
                key={stat.id} 
                onClick={() => handleStatClick(stat)}
                className={`${stat.bg} p-4 rounded-2xl border border-white border-opacity-50 shadow-sm flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform`}
              >
                <div className="text-white mb-1">
                  <Icon size={24} />
                </div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs font-medium text-white/80 uppercase tracking-tighter">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Gallery Thumbnail Grid (Instagram Feed) */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center">
            Lagi Happening <span className="ml-2">🔥✨</span>
          </h2>
          <a 
            href="https://www.instagram.com/ukmpr.iahngpm?igsh=MXFxNHRqbnRncDhn" 
            target="_blank" 
            rel="noreferrer"
            className="text-[10px] font-bold text-blue-600 hover:underline"
          >
            Lihat Semua
          </a>
        </div>
        <div className="bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-0.5 rounded-2xl shadow-lg">
          <div className="bg-white dark:bg-slate-800 rounded-[14px] p-4 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
              <img 
                src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/Logo-ig" 
                alt="Instagram Logo" 
                className="w-full h-full rounded-full border-2 border-white dark:border-slate-800 object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">@ukmpr.iahngpm</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Unit Kegiatan Mahasiswa Penalaran dan Riset</p>
            </div>
            <a 
              href="https://www.instagram.com/ukmpr.iahngpm?igsh=MXFxNHRqbnRncDhn" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full shadow-md shadow-blue-200"
            >
              Follow
            </a>
          </div>
        </div>
        <div className="flex overflow-x-auto space-x-3 py-4 scrollbar-hide snap-x">
          {galleryImages.map((img, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedGalleryImage(img)}
              className="flex-shrink-0 w-40 aspect-[4/5] rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 snap-center cursor-pointer active:scale-95 transition-transform relative group"
            >
              <img src={img} alt={`Gallery ${i}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
            </div>
          ))}
        </div>
      </div>

      {/* Tech News Grid (Clickable) */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white">UKMPR Insights 💡</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {news.map((item: any, i: number) => (
            <div 
              key={i} 
              onClick={() => onOpenArticle(item)}
              className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-400 px-2 py-1 rounded-md">{item.category}</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{item.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{item.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Footer */}
      <footer className="pt-10 pb-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-4">
        <div className="flex justify-center space-x-6">
          <button 
            onClick={() => setIsAboutOpen(true)}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Tentang Kami
          </button>
          <button 
            onClick={() => openWhatsApp('Halo UKMPR Hub, saya ingin bertanya tentang...')}
            className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Kontak
          </button>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          © 2026 UKMPR IAHN Gde Pudja Mataram. All Rights Reserved.
        </p>
      </footer>

      {/* Gallery Modal */}
      {selectedGalleryImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedGalleryImage(null)}>
          <div className="relative w-full max-w-sm aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <img src={selectedGalleryImage} className="w-full h-full object-contain bg-slate-900" />
            <button onClick={() => setSelectedGalleryImage(null)} className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full backdrop-blur-md"><X size={20} /></button>
          </div>
        </div>
      )}

      {/* Ad Popup Modal */}
      {isAdOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsAdOpen(false)}>
          <div className="relative w-full max-w-xs aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-500" onClick={e => e.stopPropagation()}>
            <img 
              src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/creativity-mainposter.webp" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
            <button 
              onClick={() => setIsAdOpen(false)} 
              className="absolute top-3 right-3 p-1.5 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-black/60 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Stat Details Modal */}
      {selectedStatDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-300 max-h-[70vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Daftar {selectedStatDetails.label}</h3>
              <button onClick={() => setSelectedStatDetails(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="space-y-4 overflow-y-auto pr-2">
              {selectedStatDetails.details.map((d: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-900 dark:bg-opacity-50 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{d.title}</h4>
                    {d.date && <span className="text-[10px] text-slate-400 dark:text-slate-500">{d.date}</span>}
                    {d.count && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{d.count}</span>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{d.desc}</p>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setSelectedStatDetails(null)}
              className="w-full mt-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* About Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex flex-col mb-6">
              <div className="flex justify-start space-x-4 mb-4">
                <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/logo-iahn.png" alt="Logo IAHN" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
                <img src="https://storage.googleapis.com/ai-studio-bucket-353083286262-us-west1/Ukmpr/Logo-ukmpr" alt="Logo UKMPR" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
              </div>
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Tentang UKMPR Hub</h3>
                <button onClick={() => setIsAboutOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
            </div>
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>UKMPR Hub</strong> adalah platform digital resmi Unit Kegiatan Mahasiswa Penalaran dan Riset (UKMPR) IAHN Gde Pudja Mataram.
              </p>
              <p>
                Aplikasi ini dirancang untuk memfasilitasi anggota dalam mengakses arsip riset, mendapatkan bimbingan mentor, dan tetap terhubung dengan perkembangan teknologi terbaru melalui fitur AI-powered insights.
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-400">
                  Dev. by <span className="font-bold text-slate-600 dark:text-slate-200">UKMPR Team</span>
                </p>
                <p className="text-[10px] text-slate-400">
                  Design by <a href="https://instagram.com/dharmayanggg" target="_blank" rel="noreferrer" className="font-bold text-blue-500 hover:underline">@dharmayanggg</a>
                </p>
              </div>
              <p className="font-bold text-blue-600">#BernalarCerdas #RisetMasaDepan</p>
              
              {isAiLeaked && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl mt-4">
                  <p className="text-[10px] text-red-600 dark:text-red-400 mb-2">
                    Koneksi AI terputus (API Key bermasalah). Silakan gunakan kunci API Anda sendiri.
                  </p>
                  <button 
                    onClick={handleFixAi}
                    className="text-[10px] font-bold text-white bg-red-500 px-3 py-1 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Hubungkan API Key Baru
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsAboutOpen(false)}
              className="w-full mt-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/50"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleDetailView({ article, onBack }: { article: any, onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="relative h-64 shrink-0">
        <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black bg-opacity-80 via-black bg-opacity-20 to-transparent" />
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-md text-white rounded-full border border-white border-opacity-30"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="absolute bottom-6 left-6 right-6">
          <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-1 rounded-md mb-2 inline-block uppercase tracking-wider">{article.category}</span>
          <h1 className="text-2xl font-bold text-white leading-tight">{article.title}</h1>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center space-x-3 text-slate-400 dark:text-slate-500 text-xs">
          <div className="flex items-center"><Clock size={14} className="mr-1" /> 5 Menit Baca</div>
          <div className="flex items-center"><User size={14} className="mr-1" /> AI Generated</div>
        </div>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-line">
            {article.content}
          </p>
        </div>
        <div className="pt-10 pb-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Bagikan Artikel</h4>
          <div className="flex space-x-3">
            <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><Share2 size={18} /></button>
            <button className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><MessageSquare size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainstormingView({ onClose, myProfile, isDarkMode }: { onClose: () => void, myProfile: any, isDarkMode: boolean }) {
  const [step, setStep] = useState<'form' | 'chat'>('form');
  const [formData, setFormData] = useState({
    nickname: '',
    topic: '',
    problem: '',
    location: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    if (!myProfile) return;

    fetch('/api/brainstorm/history')
      .then(res => {
        if (res.status === 401) throw new Error("Unauthorized");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChatHistory(data);
        }
      })
      .catch(err => console.error("Failed to fetch history:", err));

    // Keyboard detection
    const handleResize = () => {
      const isKeyboard = window.innerHeight < window.outerHeight * 0.75;
      setIsKeyboardVisible(isKeyboard);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [myProfile]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (step === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, step, isAnalyzing]);

  if (!myProfile) {
    return (
      <div className="absolute inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Login Diperlukan</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
          Fitur Brainstorming Riset menyimpan riwayat diskusi Anda secara privat. Silakan login untuk melanjutkan.
        </p>
        <button 
          onClick={onClose} 
          className="w-full max-w-xs bg-purple-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-200 dark:shadow-none hover:bg-purple-700 active:scale-95 transition-all"
        >
          Kembali ke Menu Utama
        </button>
      </div>
    );
  }

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setStep('chat'); // Move to chat view immediately to show loading state

    try {
      const aiResponse = await brainstormInitiate(formData.nickname, formData.topic, formData.problem, formData.location);
      
      const userQuery = `Initial Brainstorm:\n- Topik: ${formData.topic}\n- Masalah: ${formData.problem}\n- Lokasi: ${formData.location}`;
      
      // Save to backend
      await fetch('/api/brainstorm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [
            { role: 'user', content: userQuery },
            { role: 'model', content: aiResponse }
          ]
        })
      });

      setChatHistory(prev => [
        ...prev, 
        { role: 'user', text: userQuery },
        { role: 'model', text: aiResponse }
      ]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', text: 'Maaf, terjadi kesalahan koneksi.' }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      // Format history for Gemini
      const history = chatHistory.map(h => ({
        role: h.role,
        content: h.text
      }));

      const aiResponse = await brainstormMessage(userMsg, history);
      
      // Save to backend
      await fetch('/api/brainstorm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [
            { role: 'user', content: userMsg },
            { role: 'model', content: aiResponse }
          ]
        })
      });

      setChatHistory(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'model', text: 'Gagal mengirim pesan.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleBack = () => {
    if (step === 'chat') {
      // If we have history, maybe we want to go back to form? 
      // Or just close? Let's go back to form to allow new brainstorm.
      setStep('form');
    } else {
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-50 dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-300">
      {/* HEADER */}
      <div className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 py-3 shadow-sm z-10">
        <button 
          onClick={handleBack} 
          className="p-2 -ml-2 text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex flex-col items-center">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center">
            <Bot size={16} className="mr-1.5 text-purple-500" /> Suhu UKMPR <span className="ml-1.5 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          </h2>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Online • AI Assistant</span>
        </div>
        
        <div className="w-8"></div> {/* Spacer for alignment */}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative bg-slate-100 dark:bg-slate-900">
        
        {/* STEP 1: FORM */}
        {step === 'form' && (
          <div className="h-full overflow-y-auto p-5 animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="max-w-sm mx-auto space-y-6 pb-10">
              <div className="text-center space-y-2 mt-4">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Lightbulb size={32} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mulai Riset Baru</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Isi form di bawah ini untuk mendapatkan analisa mendalam dari Suhu UKMPR.
                </p>
              </div>

              {/* History Button */}
              {chatHistory.length > 0 && (
                <button 
                  onClick={() => setStep('chat')}
                  className="w-full bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/50 p-4 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                      <MessageSquare size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Lanjutkan Diskusi</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-500">{chatHistory.length} pesan tersimpan</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-purple-500 transition-colors" />
                </button>
              )}

              <form onSubmit={handleProcess} className="space-y-4 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nama Panggilan</label>
                  <input 
                    required
                    value={formData.nickname}
                    onChange={e => setFormData({...formData, nickname: e.target.value})}
                    placeholder="Contoh: Dharma"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Topik Riset</label>
                  <input 
                    required
                    value={formData.topic}
                    onChange={e => setFormData({...formData, topic: e.target.value})}
                    placeholder="Contoh: Pendidikan Inklusif"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Masalah Utama</label>
                  <textarea 
                    required
                    value={formData.problem}
                    onChange={e => setFormData({...formData, problem: e.target.value})}
                    placeholder="Contoh: Kurangnya media pembelajaran untuk anak tunarungu"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-h-[100px] resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Lokasi Penelitian</label>
                  <input 
                    required
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Contoh: Mataram, NTB"
                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                  >
                    <span>Proses Sekarang</span>
                    <Zap size={18} className="animate-pulse" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 2: CHAT */}
        {step === 'chat' && (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
              {chatHistory.length === 0 && !isAnalyzing && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 opacity-50">
                  <MessageSquare size={48} />
                  <p className="text-sm">Belum ada riwayat diskusi</p>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-100 dark:border-slate-700'
                  }`}>
                    <div className="markdown-body">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}

              {isAnalyzing && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 shadow-sm flex items-center space-x-3">
                    <Cpu size={20} className="text-purple-500 animate-spin" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Sedang menganalisa data...</span>
                  </div>
                </div>
              )}

              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className={`p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 ${isKeyboardVisible ? 'pb-2' : 'pb-6'}`}>
              <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ketik pesan untuk Suhu..."
                  className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-0 placeholder-slate-400"
                  disabled={isAnalyzing || isChatting}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isAnalyzing || isChatting}
                  className="p-2.5 bg-purple-600 text-white rounded-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 active:scale-95 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RisetMenuView({ docs, fetchData, mentors, openWhatsApp, myProfile, isDarkMode }: any) {
  const [view, setView] = useState<'menu' | 'bank' | 'klinik'>('menu');
  const [isBrainstormingOpen, setIsBrainstormingOpen] = useState(false);

  if (view === 'bank') return (
    <div>
      <button onClick={() => setView('menu')} className="mb-4 flex items-center text-sm font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400">
        <ChevronLeft size={16} className="mr-1" /> Kembali
      </button>
      <RepositoryView docs={docs} fetchData={fetchData} isDarkMode={isDarkMode} />
    </div>
  );

  if (view === 'klinik') return (
    <div>
      <button onClick={() => setView('menu')} className="mb-4 flex items-center text-sm font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400">
        <ChevronLeft size={16} className="mr-1" /> Kembali
      </button>
      <MentoringView mentors={mentors} openWhatsApp={openWhatsApp} isDarkMode={isDarkMode} />
    </div>
  );

  return (
    <>
      <div className="space-y-6 animate-in fade-in zoom-in duration-300 pb-24">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pusat Riset 🧬</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Akses sumber daya dan bimbingan riset terpadu.</p>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div 
            onClick={() => setIsBrainstormingOpen(true)}
            className="bg-purple-600 rounded-3xl p-6 text-white cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden"
          >
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <Lightbulb size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-purple-700 bg-opacity-80 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg">
                <Lightbulb size={24} />
              </div>
              <h3 className="text-xl font-bold mb-1">Brainstorming Riset</h3>
              <p className="text-purple-100 text-xs leading-relaxed max-w-[200px]">
                Bingung mau riset apa? Konsultasi dengan Suhu UKMPR untuk ide penelitian inovatif.
              </p>
            </div>
          </div>

          <div 
            onClick={() => setView('bank')}
            className="bg-blue-500 rounded-3xl p-6 text-white cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden"
          >
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <BookOpen size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-blue-600 bg-opacity-80 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg">
                <BookOpen size={24} />
              </div>
              <h3 className="text-xl font-bold mb-1">Bank Riset</h3>
              <p className="text-blue-100 text-xs leading-relaxed max-w-[200px]">
                Akses ribuan arsip proposal PKM, Essay, dan Jurnal karya anggota UKMPR.
              </p>
            </div>
          </div>

          <div 
            onClick={() => setView('klinik')}
            className="bg-emerald-500 rounded-3xl p-6 text-white cursor-pointer hover:scale-[1.02] transition-transform relative overflow-hidden"
          >
            <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <MessageSquare size={120} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-emerald-600 bg-opacity-80 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm shadow-lg">
                <MessageSquare size={24} />
              </div>
              <h3 className="text-xl font-bold mb-1">Klinik Riset</h3>
              <p className="text-emerald-100 text-xs leading-relaxed max-w-[200px]">
                Konsultasi dan bimbingan intensif dengan mentor berpengalaman.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {isBrainstormingOpen && <BrainstormingView onClose={() => setIsBrainstormingOpen(false)} myProfile={myProfile} isDarkMode={isDarkMode} />}
    </>
  );
}

function PostCard({ 
  post, 
  myProfile, 
  onLike, 
  onComment, 
  onDelete, 
  onEdit, 
  onVote, 
  onViewUser, 
  onViewImage,
  showEmojiPicker,
  setShowEmojiPicker,
  commentingPostId,
  setCommentingPostId,
  commentContent,
  setCommentContent,
  reactions
}: any) {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-start space-x-3">
        <img 
          src={post.authorPhoto} 
          alt={post.authorName} 
          className="w-10 h-10 rounded-full bg-slate-200 object-cover cursor-pointer" 
          onClick={() => onViewUser(post.authorUsername)}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h4 
                className="font-bold text-sm text-slate-800 dark:text-white cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => onViewUser(post.authorUsername)}
              >
                @{post.authorUsername}
              </h4>
              <span className="text-[10px] text-slate-400">• {new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              {post.activityLabel && (
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                  {post.activityLabel}
                </span>
              )}
              {myProfile?.id === post.userId && (
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={() => onEdit(post)}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    onClick={() => onDelete(post.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">{post.authorRole}</p>
          
          {post.content && <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed mb-3">{post.content}</p>}
          
          {post.image && (
            <div 
              className="rounded-xl overflow-hidden mb-3 border border-slate-100 dark:border-slate-700 cursor-zoom-in"
              onClick={() => onViewImage(post.image!)}
            >
              <img src={post.image} alt="Post" className="w-full h-auto max-h-96 object-cover" />
            </div>
          )}

          {post.poll && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-3 space-y-3">
              <h5 className="font-bold text-sm text-slate-800 dark:text-white">{post.poll.question}</h5>
              <div className="space-y-2">
                {post.poll.options.map((opt: any, idx: number) => {
                  const totalVotes = post.poll?.options.reduce((acc: number, curr: any) => acc + curr.votes, 0) || 1;
                  const percentage = Math.round((opt.votes / totalVotes) * 100);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => onVote(post.id, idx)}
                      className="relative h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform"
                    >
                      <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                      <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
                        <span className="text-slate-700 dark:text-slate-200">{opt.text}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-bold">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {post.note && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/30 mb-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <PenTool size={48} className="text-yellow-600" />
              </div>
              <p className="text-sm text-yellow-900 dark:text-yellow-200 leading-relaxed whitespace-pre-wrap italic">
                "{post.note}"
              </p>
            </div>
          )}
          
          <div className="flex items-center space-x-6 mt-4 text-slate-400 relative">
            <div className="relative">
              <button 
                onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)}
                className={`flex items-center space-x-1 transition-colors group ${post.likes.some((l: any) => l.userId === myProfile?.id) ? 'text-red-500' : 'hover:text-red-500'}`}
              >
                {post.likes.some((l: any) => l.userId === myProfile?.id) ? (
                  <span className="text-sm">{post.likes.find((l: any) => l.userId === myProfile?.id)?.emoji || '❤️'}</span>
                ) : (
                  <Heart size={16} className="group-hover:fill-current" />
                )}
                <span className="text-xs font-bold">{post.likes.length}</span>
              </button>
              {showEmojiPicker === post.id && (
                <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-800 p-2 rounded-full shadow-xl border border-slate-100 dark:border-slate-700 flex space-x-2 animate-in slide-in-from-bottom-2 duration-200 z-10">
                  {reactions.map((emoji: string) => (
                    <button 
                      key={emoji} 
                      onClick={() => onLike(post.id, emoji)}
                      className="hover:scale-125 transition-transform text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setCommentingPostId(commentingPostId === post.id ? null : post.id)}
              className={`flex items-center space-x-1 hover:text-blue-500 transition-colors ${commentingPostId === post.id ? 'text-blue-600' : ''}`}
            >
              <MessageCircle size={16} />
              <span className="text-xs font-bold">{post.comments.length}</span>
            </button>
            
            <button className="flex items-center space-x-1 hover:text-green-500 transition-colors">
              <Share2 size={16} />
            </button>
          </div>

          {/* Comments Section */}
          {commentingPostId === post.id && (
            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 space-y-4 animate-in fade-in duration-300">
              <div className="relative pl-4 space-y-4">
                {/* Hierarchy Line */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                
                {post.comments.map((comment: any) => (
                  <div key={comment.id} className="flex space-x-3 relative">
                    {/* Horizontal connector line */}
                    <div className="absolute -left-4 top-4 w-3 h-0.5 bg-slate-100 dark:bg-slate-800"></div>
                    
                    <img src={comment.authorPhoto} alt={comment.authorUsername} className="w-8 h-8 rounded-full object-cover bg-slate-100 z-10" />
                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">@{comment.authorUsername}</span>
                        <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <input 
                  type="text" 
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Tulis komentar..." 
                  className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-full px-4 py-2 text-xs focus:ring-blue-500 dark:text-white"
                  onKeyDown={(e) => e.key === 'Enter' && onComment(post.id)}
                />
                <button 
                  onClick={() => onComment(post.id)}
                  disabled={!commentContent.trim()}
                  className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedView({ posts, setPosts, myProfile, setMyProfile, isPostingModalOpen, setIsPostingModalOpen, isDarkMode }: any) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'text' | 'photo' | 'poll' | 'note'>('text');
  const [image, setImage] = useState<string | null>(null);
  const [poll, setPoll] = useState<{ question: string, options: string[] }>({ question: '', options: ['', ''] });
  const [note, setNote] = useState('');
  const [activityLabel, setActivityLabel] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [viewedUser, setViewedUser] = useState<Member | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (postType !== 'photo' && isCameraOpen) {
      stopCamera();
    }
  }, [postType]);

  useEffect(() => {
    if (isPostingModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isPostingModalOpen]);

  const activityLabels = [
    'Riset', 'Observasi', 'Bimbingan', 'Event', 'Bootcamp', 
    'Ngopi', 'Belajar Kelompok', 'Diskusi', 'PKM', 'Lomba'
  ];

  const reactions = ['❤️', '👍', '🔥', '👏', '😮', '💡'];

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed", err);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        setImage(data);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setContent('');
    setImage(null);
    setPoll({ question: '', options: ['', ''] });
    setNote('');
    setActivityLabel('');
    setPostType('text');
    setEditingPostId(null);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return alert('Silakan login untuk memposting');
    
    setIsPosting(true);
    
    // Optimistic Update for New Post
    if (!editingPostId) {
      const tempPost: Post = {
        id: Date.now(),
        userId: myProfile.id,
        content: content || '',
        likes: [],
        comments: [],
        image: image || undefined,
        poll: poll.question ? { question: poll.question, options: poll.options.map(o => ({ text: o, votes: 0 })) } : undefined,
        note: note || undefined,
        activityLabel: activityLabel || undefined,
        createdAt: Date.now(),
        authorName: myProfile.name,
        authorUsername: myProfile.username || '',
        authorPhoto: myProfile.photo || '',
        authorRole: myProfile.role
      };
      setPosts((prev: Post[]) => [tempPost, ...prev]);
    } else {
      // Optimistic Update for Editing Post
      setPosts((prev: Post[]) => prev.map(p => {
        if (p.id === editingPostId) {
          return {
            ...p,
            content: content || '',
            image: image || undefined,
            poll: poll.question ? { question: poll.question, options: poll.options.map(o => ({ text: o, votes: 0 })) } : undefined,
            note: note || undefined,
            activityLabel: activityLabel || undefined
          };
        }
        return p;
      }));
    }

    try {
      const payload: any = { 
        userId: myProfile.id, 
        content: content || '',
        activityLabel 
      };

      if (postType === 'photo') payload.image = image;
      if (postType === 'poll') {
        payload.poll = {
          question: poll.question,
          options: poll.options.map(opt => ({ text: opt, votes: 0 }))
        };
      }
      if (postType === 'note') payload.note = note;

      const url = editingPostId ? `/api/posts/${editingPostId}` : '/api/posts';
      const method = editingPostId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        resetForm();
        setIsPostingModalOpen(false);
        // Refresh posts to sync with server
        const updated = await fetch('/api/posts').then(r => r.json());
        setPosts(updated);
      } else {
        const err = await res.json();
        alert('Gagal memposting: ' + (err.error || res.statusText));
        // Revert optimistic update if failed? (Optional, but good for UX)
        const updated = await fetch('/api/posts').then(r => r.json());
        setPosts(updated);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memposting');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Hapus postingan ini?')) return;
    
    // Optimistic Delete
    setPosts((prev: Post[]) => prev.filter(p => p.id !== postId));

    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Gagal menghapus postingan');
      const updated = await fetch('/api/posts').then(r => r.json());
      setPosts(updated);
    }
  };

  const startEditingPost = (post: Post) => {
    setEditingPostId(post.id);
    setContent(post.content || '');
    setActivityLabel(post.activityLabel || '');
    if (post.image) {
      setPostType('photo');
      setImage(post.image);
    } else if (post.poll) {
      setPostType('poll');
      setPoll({ 
        question: post.poll.question, 
        options: post.poll.options.map((o: any) => o.text) 
      });
    } else if (post.note) {
      setPostType('note');
      setNote(post.note);
    } else {
      setPostType('text');
    }
    setIsPostingModalOpen(true);
  };

  const handleVote = async (postId: number, optionIndex: number) => {
    if (!myProfile) return alert('Silakan login untuk memberikan suara');
    
    // Optimistic Update
    setPosts((prevPosts: Post[]) => prevPosts.map(post => {
      if (post.id === postId && post.poll) {
        const newOptions = [...post.poll.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], votes: newOptions[optionIndex].votes + 1 };
        return { ...post, poll: { ...post.poll, options: newOptions } };
      }
      return post;
    }));

    const res = await fetch(`/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myProfile.id, optionIndex })
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Gagal memberikan suara');
      // Sync with server to revert if failed
      const updated = await fetch('/api/posts').then(r => r.json());
      setPosts(updated);
    }
  };

  const handleLike = async (postId: number, emoji: string) => {
    if (!myProfile) return alert('Silakan login');
    
    // Optimistic Update
    setPosts((prevPosts: Post[]) => prevPosts.map(post => {
      if (post.id === postId) {
        const alreadyLiked = post.likes.find((l: any) => l.userId === myProfile.id);
        let newLikes;
        if (alreadyLiked) {
          newLikes = post.likes.filter((l: any) => l.userId !== myProfile.id);
        } else {
          newLikes = [...post.likes, { userId: myProfile.id, emoji }];
        }
        return { ...post, likes: newLikes };
      }
      return post;
    }));

    const res = await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myProfile.id, emoji })
    });
    
    if (res.ok) {
      // Sync with server to be sure
      const updated = await fetch('/api/posts').then(r => r.json());
      setPosts(updated);
      setShowEmojiPicker(null);
    }
  };

  const handleComment = async (postId: number) => {
    if (!myProfile) return alert('Silakan login');
    if (!commentContent.trim()) return;

    const tempComment = {
      id: Date.now(),
      postId,
      userId: myProfile.id,
      content: commentContent,
      createdAt: Date.now(),
      authorName: myProfile.name,
      authorPhoto: myProfile.photo,
      authorUsername: myProfile.username
    };

    // Optimistic Update
    setPosts((prevPosts: Post[]) => prevPosts.map(post => {
      if (post.id === postId) {
        return { ...post, comments: [...(post.comments || []), tempComment] };
      }
      return post;
    }));

    setCommentContent('');
    setCommentingPostId(null);

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myProfile.id, content: commentContent })
    });

    if (res.ok) {
      const updated = await fetch('/api/posts').then(r => r.json());
      setPosts(updated);
    }
  };

  if (viewedUser) {
    return <UserProfileView 
      user={viewedUser} 
      onBack={() => setViewedUser(null)} 
      myProfile={myProfile} 
      setMyProfile={setMyProfile}
      isDarkMode={isDarkMode}
      onLike={handleLike}
      onComment={handleComment}
      onDelete={handleDeletePost}
      onEdit={startEditingPost}
      onVote={handleVote}
      onViewImage={setSelectedImage}
      reactions={reactions}
    />;
  }

  return (
    <div className="space-y-6 relative min-h-full">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Community Feed 💬</h1>
        <button onClick={() => fetch('/api/posts').then(r => r.json()).then(setPosts)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
          <Clock size={18} />
        </button>
      </div>

      {/* FAB to open Posting Modal */}
      {myProfile && (
        <button 
          onClick={() => { resetForm(); setIsPostingModalOpen(true); }}
          className="fixed bottom-36 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Posting Modal (Threads Style) */}
      {isPostingModalOpen && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom duration-300 h-[100dvh] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <button onClick={() => { setIsPostingModalOpen(false); resetForm(); }} className="text-slate-500 font-medium">Batal</button>
            <h3 className="font-bold text-slate-800 dark:text-white">{editingPostId ? 'Edit Postingan' : 'Buat Postingan'}</h3>
            <button 
              onClick={handlePost}
              disabled={isPosting || (!content.trim() && !image && !poll.question && !note)}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-50"
            >
              {isPosting ? '...' : (editingPostId ? 'Simpan' : 'Posting')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-32">
            <div className="flex space-x-3">
              <img src={myProfile?.photo} alt="Me" className="w-10 h-10 rounded-full bg-slate-200 object-cover" />
              <div className="flex-1 space-y-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">@{myProfile?.username}</span>
                  <textarea 
                    value={content}
                    autoFocus
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Apa yang sedang kamu riset hari ini?" 
                    className="w-full bg-transparent text-base border-none focus:ring-0 p-0 resize-none placeholder:text-slate-400 dark:text-white mt-1 outline-none"
                    rows={4}
                  />
                </div>

                {/* Post Type Selector */}
                <div className="flex space-x-4 border-y border-slate-50 dark:border-slate-800 py-3">
                  {[
                    { id: 'text', icon: <FileText size={20} /> },
                    { id: 'photo', icon: <Camera size={20} /> },
                    { id: 'poll', icon: <TrendingUp size={20} /> },
                    { id: 'note', icon: <PenTool size={20} /> }
                  ].map(type => (
                    <button 
                      key={type.id}
                      onClick={() => setPostType(type.id as any)}
                      className={`p-2 rounded-xl transition-colors ${postType === type.id ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                      {type.icon}
                    </button>
                  ))}
                </div>

                {postType === 'photo' && (
                  <div className="space-y-3">
                    {image ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                        <img src={image} alt="Preview" className="w-full h-64 object-cover" />
                        <button onClick={() => setImage(null)} className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full backdrop-blur-md">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          type="button" 
                          onClick={startCamera}
                          className="flex flex-col items-center justify-center h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Camera size={28} />
                          <span className="text-[10px] mt-2 font-bold uppercase tracking-wider">Kamera</span>
                        </button>
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Upload size={28} />
                          <span className="text-[10px] mt-2 font-bold uppercase tracking-wider">Upload</span>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </button>
                      </div>
                    )}

                    {isCameraOpen && (
                      <div className="fixed inset-0 z-[110] bg-black flex flex-col">
                        <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
                        <canvas ref={canvasRef} className="hidden" />
                        <div className="p-8 flex justify-between items-center bg-black/50 backdrop-blur-md">
                          <button onClick={stopCamera} className="text-white font-bold">Batal</button>
                          <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center active:scale-90 transition-transform">
                            <div className="w-12 h-12 bg-white rounded-full border-2 border-slate-800" />
                          </button>
                          <div className="w-10" /> {/* Spacer */}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {postType === 'poll' && (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <input 
                      type="text" 
                      placeholder="Pertanyaan polling..." 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                      value={poll.question}
                      onChange={(e) => setPoll({ ...poll, question: e.target.value })}
                    />
                    {poll.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input 
                          type="text" 
                          placeholder={`Opsi ${idx + 1}`} 
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs dark:text-white"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...poll.options];
                            newOpts[idx] = e.target.value;
                            setPoll({ ...poll, options: newOpts });
                          }}
                        />
                        {poll.options.length > 2 && (
                          <button type="button" onClick={() => setPoll({ ...poll, options: poll.options.filter((_, i) => i !== idx) })} className="text-red-500">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })}
                      className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex items-center"
                    >
                      <Plus size={12} className="mr-1" /> Tambah Opsi
                    </button>
                  </div>
                )}

                {postType === 'note' && (
                  <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tulis catatan riset detail di sini..." 
                    className="w-full bg-yellow-50 dark:bg-yellow-900/20 text-sm border border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-4 resize-none placeholder:text-yellow-600/50 text-yellow-900 dark:text-yellow-200"
                    rows={6}
                  />
                )}

                <div className="pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Pilih Aktivitas:</span>
                  <div className="flex flex-wrap gap-2">
                    {activityLabels.map(label => (
                      <button 
                        key={label}
                        type="button"
                        onClick={() => setActivityLabel(activityLabel === label ? '' : label)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${activityLabel === label ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 hover:bg-slate-100'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-4">
        {posts.map((post: Post) => (
          <PostCard 
            key={post.id}
            post={post}
            myProfile={myProfile}
            onLike={handleLike}
            onComment={handleComment}
            onDelete={handleDeletePost}
            onEdit={startEditingPost}
            onVote={handleVote}
            onViewUser={(username: string) => fetch(`/api/members/username/${username}`).then(r => r.json()).then(setViewedUser)}
            onViewImage={setSelectedImage}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            commentingPostId={commentingPostId}
            setCommentingPostId={setCommentingPostId}
            commentContent={commentContent}
            setCommentContent={setCommentContent}
            reactions={reactions}
          />
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={32} />
          </button>
          <img 
            src={selectedImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function UserProfileView({ 
  user, 
  onBack, 
  myProfile, 
  setMyProfile, 
  isDarkMode,
  onLike,
  onComment,
  onDelete,
  onEdit,
  onVote,
  onViewImage,
  reactions
}: any) {
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/posts/user/${user.id}`).then(r => r.json()).then(setUserPosts);
  }, [user.id]);

  const internalOnDelete = async (postId: number) => {
    if (confirm('Hapus postingan ini?')) {
      setUserPosts(prev => prev.filter(p => p.id !== postId));
      onDelete(postId);
    }
  };

  const internalOnLike = async (postId: number, emoji: string) => {
    setUserPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const alreadyLiked = post.likes.find((l: any) => l.userId === myProfile?.id);
        let newLikes;
        if (alreadyLiked) {
          newLikes = post.likes.filter((l: any) => l.userId !== myProfile?.id);
        } else {
          newLikes = [...post.likes, { userId: myProfile?.id, emoji }];
        }
        return { ...post, likes: newLikes };
      }
      return post;
    }));
    onLike(postId, emoji);
    setShowEmojiPicker(null);
  };

  const internalOnComment = async (postId: number) => {
    if (!commentContent.trim()) return;
    const tempComment = {
      id: Date.now(),
      postId,
      userId: myProfile?.id,
      content: commentContent,
      createdAt: Date.now(),
      authorName: myProfile?.name,
      authorPhoto: myProfile?.photo,
      authorUsername: myProfile?.username
    };
    setUserPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return { ...post, comments: [...(post.comments || []), tempComment] };
      }
      return post;
    }));
    onComment(postId);
    setCommentContent('');
    setCommentingPostId(null);
  };

  const internalOnVote = async (postId: number, optionIndex: number) => {
    setUserPosts(prev => prev.map(post => {
      if (post.id === postId && post.poll) {
        const newOptions = [...post.poll.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], votes: newOptions[optionIndex].votes + 1 };
        return { ...post, poll: { ...post.poll, options: newOptions } };
      }
      return post;
    }));
    onVote(postId, optionIndex);
  };

  if (isEditing && myProfile) {
    return (
      <div className="fixed inset-0 z-[110] bg-white dark:bg-slate-900 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setIsEditing(false)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="ml-2 text-lg font-bold text-slate-800 dark:text-white">Edit Profil</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <FeedProfileEdit myProfile={myProfile} setMyProfile={setMyProfile} isDarkMode={isDarkMode} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-300 min-h-full bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center px-2 pt-2">
        <button onClick={onBack} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm hover:bg-white rounded-full text-slate-700 dark:text-slate-200 transition-all active:scale-90">
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden mx-1 p-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <img src={user.photo} alt={user.name} className="w-24 h-24 rounded-3xl border-4 border-slate-50 dark:border-slate-700 shadow-md object-cover bg-white" />
          </div>
          
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
            <p className="text-blue-600 dark:text-blue-400 font-bold text-sm">@{user.username}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.role} • {user.major}</p>
          </div>

          {myProfile?.id === user.id && (
            <button 
              onClick={() => setIsEditing(true)}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-none transition-all active:scale-95"
            >
              Edit Profil
            </button>
          )}
        </div>

          {user.bio && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
              "{user.bio}"
            </p>
          )}

          <div className="flex space-x-6 mt-6 pt-6 border-t border-slate-50 dark:border-slate-700">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800 dark:text-white">{userPosts.length}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Postingan</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800 dark:text-white">{user.entryYear}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Angkatan</p>
            </div>
          </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-white px-1">Postingan Terbaru</h3>
        {userPosts.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-2xl text-center border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-slate-400 text-sm">Belum ada postingan.</p>
          </div>
        ) : (
          userPosts.map(post => (
            <PostCard 
              key={post.id}
              post={post}
              myProfile={myProfile}
              onLike={internalOnLike}
              onComment={internalOnComment}
              onDelete={internalOnDelete}
              onEdit={onEdit}
              onVote={internalOnVote}
              onViewUser={() => {}} // Already on profile
              onViewImage={setSelectedImage}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              commentingPostId={commentingPostId}
              setCommentingPostId={setCommentingPostId}
              commentContent={commentContent}
              setCommentContent={setCommentContent}
              reactions={reactions}
            />
          ))
        )}
      </div>

      {/* Image Modal for Profile View */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={32} />
          </button>
          <img 
            src={selectedImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in duration-300" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function RepositoryView({ docs, fetchData, isDarkMode }: { docs: ResearchDoc[], fetchData: () => void, isDarkMode: boolean }) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Bank Riset</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Arsip karya terbaik UKMPR.</p>
        </div>
        <button 
          onClick={() => setIsUploading(true)}
          className="bg-blue-600 text-white p-2 rounded-xl shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Upload size={20} />
        </button>
      </div>

      {isUploading ? (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white">Upload Karya</h3>
            <button onClick={() => setIsUploading(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const newDoc = {
              title: formData.get('title') as string,
              category: formData.get('category') as string,
              author: formData.get('author') as string,
              year: parseInt(formData.get('year') as string)
            };
            
            await fetch('/api/research', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newDoc)
            });
            
            fetchData();
            setIsUploading(false);
          }} className="space-y-3">
            <input name="title" required placeholder="Judul Karya" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <select name="category" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}>
              <option value="">Pilih Jenis</option>
              <option value="PKM">PKM</option>
              <option value="Essay">Essay</option>
              <option value="Jurnal">Jurnal</option>
              <option value="Modul">Modul</option>
            </select>
            <input name="author" required placeholder="Penulis / Tim" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="year" required type="number" placeholder="Tahun" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500">
              <Upload size={24} className="mb-2 text-slate-400" />
              <span className="text-xs font-medium">Pilih File (PDF/DOCX)</span>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">Upload Sekarang</button>
          </form>
        </div>
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari judul proposal atau essay..." 
              className={`w-full pl-10 pr-4 py-3 border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm`}
            />
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {['Semua', 'PKM', 'Essay', 'Jurnal', 'Modul'].map((tag, i) => (
              <button key={i} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 ${i === 0 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/50' : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'}`}>
                {tag}
              </button>
            ))}
          </div>

          <div className="space-y-3 mt-4">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm relative">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                    doc.category === 'PKM' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 
                    doc.category === 'Essay' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {doc.category}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{doc.year}</span>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight mb-2 pr-8">{doc.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                  <Users size={12} className="mr-1" /> {doc.author}
                </p>
                
                <button className="absolute bottom-4 right-4 w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BursaTimView({ requests, fetchData, openWhatsApp, isDarkMode }: { requests: Announcement[], fetchData: () => void, openWhatsApp: (message: string) => void, isDarkMode: boolean }) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-5 pb-24">
      <div className="bg-gradient-to-br from-sky-500 to-blue-900 rounded-2xl p-5 text-white shadow-md">
        <h1 className="text-xl font-bold">Bursa Tim 🤝</h1>
        <p className="text-blue-100 mt-1 text-xs">Cari partner riset lintas jurusan untuk kompetisi mendatang.</p>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="mt-4 w-full bg-blue-500 text-white text-sm font-bold py-2.5 rounded-xl shadow-sm hover:bg-blue-600"
          >
            + Buat Pengumuman
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white">Buat Pengumuman</h3>
            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const newRequest = {
              project: formData.get('purpose') as string,
              roleNeeded: formData.get('roleNeeded') as string,
              initiator: `${formData.get('name')} (${formData.get('major')})`,
              deadline: formData.get('deadline') as string,
              wa: formData.get('wa') as string
            };
            
            await fetch('/api/announcements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newRequest)
            });
            
            fetchData();
            setIsCreating(false);
          }} className="space-y-3">
            <input name="name" required placeholder="Nama Lengkap" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="major" required placeholder="Jurusan" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="wa" required placeholder="No. WhatsApp" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="roleNeeded" required placeholder="Posisi yang Dibutuhkan" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <textarea name="purpose" required placeholder="Tujuan (Penelitian/Diskusi/Project)" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} rows={3}></textarea>
            <input name="deadline" required placeholder="Deadline (Contoh: 2 Hari lagi)" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl mt-2">Terbitkan Pengumuman</button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center text-slate-600 dark:text-slate-400">
                    <img src={`https://ui-avatars.com/api/?name=${req.initiator.split(' ')[0]}&background=random`} alt="Ava" className="w-6 h-6 rounded-full mr-2" />
                    <span className="text-xs font-semibold">{req.initiator}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${req.status === 'Urgent' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800'}`}>
                    {req.status}
                  </span>
                </div>
              
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 leading-tight">{req.project}</h3>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 flex flex-col space-y-2">
                <div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">Dibutuhkan</p>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{req.roleNeeded}</p>
                </div>
                <div className="flex items-center text-orange-500 font-medium text-xs pt-2 border-t border-slate-200 dark:border-slate-700 border-dashed">
                  <Clock size={12} className="mr-1" /> Deadline: {req.deadline}
                </div>
              </div>

              <a 
                href={`https://wa.me/6285738488594?text=Halo%2C%20saya%20tertarik%20untuk%20mendaftar%20pada%20proyek%20${encodeURIComponent(req.project)}%20sebagai%20${encodeURIComponent(req.roleNeeded)}.`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <MessageSquare size={16} />
                <span>Chat Inisiator</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MentoringView({ mentors, openWhatsApp, isDarkMode }: { mentors: Mentor[], openWhatsApp: (message: string) => void, isDarkMode: boolean }) {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Klinik Riset</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Konsultasi 1-on-1 dengan ahli.</p>
        </div>
        <button 
          onClick={() => setIsBooking(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors"
        >
          Booking Mentor
        </button>
      </div>

      {isBooking ? (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white">Booking Mentoring</h3>
            <button onClick={() => setIsBooking(false)} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const mentorName = mentors.find(m => m.id === parseInt(formData.get('mentorId') as string))?.name;
            const message = `Halo, saya ingin booking sesi bimbingan dengan ${mentorName}.\n\nNama: ${formData.get('name')}\nJurusan: ${formData.get('major')}\nSemester: ${formData.get('semester')}\nJadwal: ${formData.get('schedule')}\nMetode: ${formData.get('method')}`;
            openWhatsApp(message);
            setIsBooking(false);
          }} className="space-y-3">
            <select name="mentorId" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}>
              <option value="">Pilih Mentor</option>
              {mentors.filter(m => m.available).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input name="name" required placeholder="Nama Lengkap" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="major" required placeholder="Jurusan & Prodi" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="semester" required placeholder="Semester" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="wa" required placeholder="No. WhatsApp" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <input name="schedule" required placeholder="Jadwal Bimbingan (Hari & Jam)" className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`} />
            <select name="method" required className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}>
              <option value="">Pilih Metode</option>
              <option value="Online">Online (Zoom/GMeet)</option>
              <option value="Offline">Offline (Kampus)</option>
            </select>
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl mt-2">Kirim Booking</button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {mentors.map((mentor) => (
            <div 
              key={mentor.id} 
              onClick={() => setSelectedMentor(mentor)}
              className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden flex flex-col h-full cursor-pointer hover:border-blue-600 hover:border-opacity-20 transition-colors"
            >
              {!mentor.available && (
                <div className="absolute top-2 right-[-25px] bg-red-500 text-white text-[9px] font-bold px-8 py-0.5 rotate-45">
                  PENUH
                </div>
              )}
              
              <img 
                src={mentor.photo || `https://ui-avatars.com/api/?name=${mentor.name.replace(/ /g, '+')}&background=random`}
                alt={mentor.name} 
                className={`w-14 h-14 rounded-full mx-auto mb-2 border-2 ${mentor.available ? 'border-green-400 p-0.5' : 'border-slate-200 p-0.5 opacity-60'}`}
              />
              <h3 className="font-bold text-sm text-slate-800 dark:text-white leading-tight">{mentor.name}</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 mb-2 flex-grow">{mentor.expertise}</p>
              
              <div className="flex items-center justify-center space-x-1">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{mentor.rating.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MENTOR DETAIL MODAL */}
      {selectedMentor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900 bg-opacity-60 backdrop-blur-sm" onClick={() => setSelectedMentor(null)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="h-24 bg-emerald-600"></div>
            <div className="px-6 pb-8">
              <div className="relative -mt-12 mb-4">
                <img 
                  src={selectedMentor.photo || `https://ui-avatars.com/api/?name=${selectedMentor.name.replace('Kak ', '').replace('Pak ', '').replace('Dr. ', '')}&size=128&background=random`} 
                  className="w-24 h-24 rounded-2xl border-4 border-white dark:border-slate-800 shadow-lg mx-auto object-cover"
                />
              </div>
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedMentor.name}</h3>
                <p className="text-blue-600 dark:text-blue-400 font-bold text-sm">{selectedMentor.expertise}</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendidikan</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedMentor.education || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pengalaman</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedMentor.experience || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prestasi</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedMentor.achievements || 'N/A'}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSelectedMentor(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminView({ fetchData, members, researchDocs, announcements, mentors, banners, stats, setIsAdmin, setMyProfile, isDarkMode }: any) {
  const [adminTab, setAdminTab] = useState('banners');
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    setEditingItem(null);
  }, [adminTab]);

  const deleteItem = async (type: string, id: number) => {
    if (!window.confirm('Hapus item ini?')) return;
    try {
      const res = await fetch(`/api/${type}/${id}`, { 
        method: 'DELETE',
        credentials: 'include' 
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Gagal menghapus item');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan');
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setStatDetails([{ title: '', date: '', desc: '' }]);
  };

  const [statDetails, setStatDetails] = useState<{title: string, date: string, desc: string}[]>([{ title: '', date: '', desc: '' }]);

  useEffect(() => {
    if (editingItem && adminTab === 'stats') {
      try {
        const details = JSON.parse(editingItem.details_json || '[]');
        setStatDetails(details.length > 0 ? details : [{ title: '', date: '', desc: '' }]);
      } catch (e) {
        setStatDetails([{ title: '', date: '', desc: '' }]);
      }
    } else {
      setStatDetails([{ title: '', date: '', desc: '' }]);
    }
  }, [editingItem, adminTab]);

  const addStatDetail = () => setStatDetails([...statDetails, { title: '', date: '', desc: '' }]);
  const removeStatDetail = (index: number) => setStatDetails(statDetails.filter((_, i) => i !== index));
  const updateStatDetail = (index: number, field: string, value: string) => {
    const newDetails = [...statDetails];
    (newDetails[index] as any)[field] = value;
    setStatDetails(newDetails);
  };

  const statColors = [
    { label: 'Blue', value: 'bg-gradient-to-br from-blue-500 to-blue-700' },
    { label: 'Emerald', value: 'bg-gradient-to-br from-emerald-500 to-emerald-700' },
    { label: 'Orange', value: 'bg-gradient-to-br from-orange-500 to-orange-700' },
    { label: 'Purple', value: 'bg-gradient-to-br from-purple-500 to-purple-700' },
    { label: 'Rose', value: 'bg-gradient-to-br from-rose-500 to-rose-700' },
    { label: 'Amber', value: 'bg-gradient-to-br from-amber-500 to-amber-700' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Admin Panel 🛠️</h1>
        <button 
          onClick={() => {
            setIsAdmin(false);
            setMyProfile(null);
            localStorage.removeItem('ukmpr_profile');
          }}
          className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
        >
          Logout Admin
        </button>
      </div>
      
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {['banners', 'stats', 'research', 'announcements', 'mentors', 'members'].map(tab => (
          <button 
            key={tab}
            onClick={() => { setAdminTab(tab); setEditingItem(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${adminTab === tab ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-4 min-h-[400px] shadow-sm">
        {adminTab === 'banners' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/banners/${editingItem.id}` : '/api/banners';
              const method = editingItem ? 'PUT' : 'POST';
              
              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: fd.get('title'), image: fd.get('image') })
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
              }
            }} className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl space-y-2`}>
              <input name="title" defaultValue={editingItem?.title || ''} placeholder="Judul Banner" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="image" defaultValue={editingItem?.image || ''} placeholder="URL Gambar" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">{editingItem ? 'Simpan Perubahan' : '+ Tambah Banner'}</button>
                {editingItem && <button type="button" onClick={cancelEdit} className={`px-3 rounded-lg text-[10px] font-bold ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>Batal</button>}
              </div>
            </form>
            {banners.map((b: any) => (
              <div key={b.id} className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <span className="text-xs font-medium truncate max-w-[200px] text-slate-700 dark:text-slate-300">{b.title}</span>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => handleEdit(b)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                  <button type="button" onClick={() => deleteItem('banners', b.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'stats' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/stats/${editingItem.id}` : '/api/stats';
              const method = editingItem ? 'PUT' : 'POST';
              
              // Filter out empty details
              const filteredDetails = statDetails.filter(d => d.title.trim());

              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  label: fd.get('label'),
                  value: fd.get('value'),
                  icon: fd.get('icon'),
                  color: 'text-white',
                  bg: fd.get('bg') || statColors[0].value,
                  sort_order: parseInt(fd.get('sort_order') as string || '0'),
                  details_json: JSON.stringify(filteredDetails)
                })
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
                setStatDetails([{ title: '', date: '', desc: '' }]);
              }
            }} className={`p-4 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'} rounded-2xl space-y-4 border border-slate-100 dark:border-slate-700`}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Label</label>
                  <input name="label" defaultValue={editingItem?.label || ''} placeholder="e.g. Prestasi" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nilai</label>
                  <input name="value" defaultValue={editingItem?.value || ''} placeholder="e.g. 18" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Pilih Warna Background</label>
                <div className="flex flex-wrap gap-2">
                  {statColors.map(c => (
                    <label key={c.value} className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="bg" 
                        value={c.value} 
                        defaultChecked={editingItem?.bg === c.value || (!editingItem && c.value === statColors[0].value)} 
                        className="peer sr-only" 
                      />
                      <div className={`w-8 h-8 rounded-full ${c.value} border-2 border-transparent peer-checked:border-white peer-checked:ring-2 peer-checked:ring-blue-500 transition-all`}></div>
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap dark:text-slate-400">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Icon</label>
                <select name="icon" defaultValue={editingItem?.icon} className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`}>
                  <option value="Award">Award</option>
                  <option value="TrendingUp">TrendingUp</option>
                  <option value="Users">Users</option>
                  <option value="BookOpen">BookOpen</option>
                  <option value="Search">Search</option>
                </select>
              </div>

              <div className="space-y-3 border-t border-slate-200 dark:border-slate-600 pt-3">
                <div className="flex justify-between items-center">
                  <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-wider`}>List Detail</p>
                  <button type="button" onClick={addStatDetail} className="text-[10px] font-bold text-blue-600 flex items-center bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                    <Plus size={12} className="mr-1" /> Tambah Item
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                  {statDetails.map((detail, idx) => (
                    <div key={idx} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} relative group`}>
                      <button 
                        type="button" 
                        onClick={() => removeStatDetail(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={10} />
                      </button>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input 
                          placeholder="Judul (e.g. Juara 1)" 
                          value={detail.title || ''}
                          onChange={(e) => updateStatDetail(idx, 'title', e.target.value)}
                          className={`p-2 text-[10px] border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} rounded-lg`}
                        />
                        <input 
                          placeholder="Tahun/Waktu" 
                          value={detail.date || ''}
                          onChange={(e) => updateStatDetail(idx, 'date', e.target.value)}
                          className={`p-2 text-[10px] border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} rounded-lg`}
                        />
                      </div>
                      <textarea 
                        placeholder="Deskripsi singkat..." 
                        value={detail.desc || ''}
                        onChange={(e) => updateStatDetail(idx, 'desc', e.target.value)}
                        className={`w-full p-2 text-[10px] border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} rounded-lg h-12 resize-none`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button className="flex-1 bg-blue-600 text-white text-xs font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all">
                  {editingItem ? 'Simpan Perubahan' : '+ Tambah Stat'}
                </button>
                {editingItem && (
                  <button type="button" onClick={cancelEdit} className={`px-4 rounded-xl text-xs font-bold ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                    Batal
                  </button>
                )}
              </div>
            </form>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {stats.map((s: any) => (
                <div key={s.id} className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className="text-xs">
                    <p className="font-bold text-slate-800 dark:text-white">{s.label}</p>
                    <p className="text-slate-500 dark:text-slate-400">{s.value}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => handleEdit(s)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                    <button type="button" onClick={() => deleteItem('stats', s.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'research' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/research/${editingItem.id}` : '/api/research';
              const method = editingItem ? 'PUT' : 'POST';
 
              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: fd.get('title'),
                  category: fd.get('category'),
                  author: fd.get('author'),
                  year: parseInt(fd.get('year') as string)
                })
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
              }
            }} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
              <input name="title" defaultValue={editingItem?.title || ''} placeholder="Judul Riset" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <select name="category" defaultValue={editingItem?.category || 'PKM'} className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white">
                <option value="PKM">PKM</option>
                <option value="Essay">Essay</option>
                <option value="Jurnal">Jurnal</option>
                <option value="Modul">Modul</option>
              </select>
              <input name="author" defaultValue={editingItem?.author || ''} placeholder="Penulis" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <input name="year" defaultValue={editingItem?.year || new Date().getFullYear()} type="number" placeholder="Tahun" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">{editingItem ? 'Simpan Perubahan' : '+ Tambah Riset'}</button>
                {editingItem && <button type="button" onClick={cancelEdit} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 rounded-lg text-[10px] font-bold">Batal</button>}
              </div>
            </form>
            {researchDocs.map((d: any) => (
              <div key={d.id} className="flex justify-between items-center p-2 border-b dark:border-slate-700">
                <span className="text-xs truncate max-w-[200px] dark:text-slate-200">{d.title}</span>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => handleEdit(d)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                  <button type="button" onClick={() => deleteItem('research', d.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'announcements' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/announcements/${editingItem.id}` : '/api/announcements';
              const method = editingItem ? 'PUT' : 'POST';
 
              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  project: fd.get('project'),
                  roleNeeded: fd.get('roleNeeded'),
                  initiator: fd.get('initiator'),
                  deadline: fd.get('deadline'),
                  wa: fd.get('wa')
                })
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
              }
            }} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
              <input name="project" defaultValue={editingItem?.project || ''} placeholder="Nama Proyek" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <input name="roleNeeded" defaultValue={editingItem?.roleNeeded || ''} placeholder="Role yang dibutuhkan" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <input name="initiator" defaultValue={editingItem?.initiator || ''} placeholder="Inisiator" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <input name="deadline" defaultValue={editingItem?.deadline || ''} placeholder="Deadline" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" required />
              <input name="wa" defaultValue={editingItem?.wa || ''} placeholder="WhatsApp" className="w-full p-2 text-xs border dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white" />
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">{editingItem ? 'Simpan Perubahan' : '+ Tambah Pengumuman'}</button>
                {editingItem && <button type="button" onClick={cancelEdit} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 rounded-lg text-[10px] font-bold">Batal</button>}
              </div>
            </form>
            {announcements.map((a: any) => (
              <div key={a.id} className="flex justify-between items-center p-2 border-b dark:border-slate-700">
                <span className="text-xs truncate max-w-[200px] dark:text-slate-200">{a.project}</span>
                <div className="flex space-x-2">
                  <button type="button" onClick={() => handleEdit(a)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                  <button type="button" onClick={() => deleteItem('announcements', a.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'mentors' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/mentors/${editingItem.id}` : '/api/mentors';
              const method = editingItem ? 'PUT' : 'POST';

              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: fd.get('name'),
                  expertise: fd.get('expertise'),
                  education: fd.get('education'),
                  experience: fd.get('experience'),
                  achievements: fd.get('achievements'),
                  photo: fd.get('photo'),
                  rating: parseFloat(fd.get('rating') as string || '5'),
                  available: parseInt(fd.get('available') as string || '1')
                })
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
              }
            }} className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl space-y-2 border border-slate-100 dark:border-slate-700`}>
              <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Mentor" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="photo" defaultValue={editingItem?.photo || ''} placeholder="URL Foto Profil" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              <input name="expertise" defaultValue={editingItem?.expertise || ''} placeholder="Keahlian" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <div className="grid grid-cols-2 gap-2">
                <input name="rating" defaultValue={editingItem?.rating || 5.0} type="number" step="0.1" min="1" max="5" placeholder="Rating (1.0 - 5.0)" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
                <select name="available" defaultValue={editingItem?.available || 1} className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`}>
                  <option value="1">Tersedia</option>
                  <option value="0">Penuh</option>
                </select>
              </div>
              <input name="education" defaultValue={editingItem?.education || ''} placeholder="Pendidikan" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              <input name="experience" defaultValue={editingItem?.experience || ''} placeholder="Pengalaman" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              <input name="achievements" defaultValue={editingItem?.achievements || ''} placeholder="Prestasi" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">{editingItem ? 'Simpan Perubahan' : '+ Tambah Mentor'}</button>
                {editingItem && <button type="button" onClick={cancelEdit} className={`px-3 rounded-lg text-[10px] font-bold ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>Batal</button>}
              </div>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {mentors.map((m: any) => (
                <div key={m.id} className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <span className="text-xs dark:text-slate-200">{m.name}</span>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => handleEdit(m)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                    <button type="button" onClick={() => deleteItem('mentors', m.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'members' && (
          <div className="space-y-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const url = editingItem ? `/api/members/${editingItem.id}` : '/api/auth/register';
              const method = editingItem ? 'PUT' : 'POST';

              const body: any = {
                name: fd.get('name'),
                nim: fd.get('nim'),
                role: fd.get('role'),
                major: fd.get('major'),
                program: fd.get('program'),
                entryYear: parseInt(fd.get('entryYear') as string || '0'),
                gradYear: parseInt(fd.get('gradYear') as string || '0'),
                wa: fd.get('wa'),
                username: fd.get('username'),
                photo: editingItem?.photo
              };

              // Only send password if it's being set/changed
              const password = fd.get('password');
              if (password) body.password = password;

              const res = await fetch(url, {
                method: method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              if (res.ok) {
                fetchData();
                (e.target as HTMLFormElement).reset();
                setEditingItem(null);
              } else {
                alert('Gagal menyimpan member. Username mungkin sudah ada.');
              }
            }} className={`p-3 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-50'} rounded-xl space-y-2 border border-slate-100 dark:border-slate-700`}>
              <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Lengkap" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="username" defaultValue={editingItem?.username || ''} placeholder="Username (Login)" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="password" type="password" placeholder={editingItem ? "Password Baru (Kosongkan jika tetap)" : "Password"} className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required={!editingItem} />
              <input name="nim" defaultValue={editingItem?.nim || ''} placeholder="NIM" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <select name="role" defaultValue={editingItem?.role || 'Anggota'} className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required>
                <option value="Anggota">Anggota</option>
                <option value="Pengurus">Pengurus</option>
                <option value="Alumni">Alumni</option>
                <option value="Admin">Admin</option>
              </select>
              <input name="major" defaultValue={editingItem?.major || ''} placeholder="Jurusan" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="program" defaultValue={editingItem?.program || ''} placeholder="Prodi" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="entryYear" defaultValue={editingItem?.entryYear || new Date().getFullYear()} type="number" placeholder="Tahun Masuk" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} required />
              <input name="gradYear" defaultValue={editingItem?.gradYear || ''} type="number" placeholder="Tahun Lulus (Opsional)" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              <input name="wa" defaultValue={editingItem?.wa || ''} placeholder="WhatsApp" className={`w-full p-2 text-xs border ${isDarkMode ? 'bg-slate-600 border-slate-500 text-white' : 'bg-white border-slate-200'} rounded-lg`} />
              
              <div className="flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">{editingItem ? 'Simpan Perubahan' : '+ Tambah Member'}</button>
                {editingItem && <button type="button" onClick={cancelEdit} className={`px-3 rounded-lg text-[10px] font-bold ${isDarkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>Batal</button>}
              </div>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {members.map((m: any) => (
                <div key={m.id} className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <div className="text-xs">
                    <p className="font-bold dark:text-white">{m.name}</p>
                    <p className="text-slate-500 dark:text-slate-400">{m.username} • {m.role}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button type="button" onClick={() => handleEdit(m)} className="text-blue-500 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Settings size={18}/></button>
                    <button type="button" onClick={() => deleteItem('members', m.id)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"><X size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedProfileEdit({ myProfile, setMyProfile, isDarkMode }: { myProfile: Member, setMyProfile: (m: Member) => void, isDarkMode: boolean }) {
  const [formData, setFormData] = useState({
    name: myProfile.name,
    username: myProfile.username || '',
    bio: myProfile.bio || '',
    photo: myProfile.photo || '',
    role: myProfile.role
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...myProfile,
          ...formData
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMyProfile(data.user);
        setMessage({ type: 'success', text: 'Profil berhasil diperbarui!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal memperbarui profil' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: 'Tidak dapat terhubung ke server.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-blue-500 border-opacity-20 shadow-inner group mb-4">
          <img 
            src={formData.photo || "https://ui-avatars.com/api/?name=User&background=4f46e5&color=fff"} 
            alt="Profile" 
            className="w-full h-full object-cover"
            id="feed-profile-preview"
          />
          <label className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Camera size={28} className="text-white" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoUpload}
            />
          </label>
        </div>
        <p className="text-[10px] text-slate-400 font-medium">Klik foto untuk ganti</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Username</label>
          <input 
            type="text" 
            value={formData.username} 
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))} 
            placeholder="Username unik" 
            className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}
          />
        </div>
        <div>
          <label className={`block text-xs font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Bio</label>
          <textarea 
            value={formData.bio} 
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))} 
            placeholder="Tentang saya..." 
            rows={4} 
            className={`w-full p-3 border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} rounded-xl text-sm`}
          ></textarea>
        </div>
        {message.text && (
          <div className={`text-xs p-2 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSaving}
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>
    </div>
  );
}

