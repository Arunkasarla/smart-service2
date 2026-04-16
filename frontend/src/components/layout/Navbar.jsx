import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Wrench, User, LogOut, LayoutDashboard, CalendarDays, Moon, Sun, MapPin, Bell, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(false);
  const { t, i18n } = useTranslation();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check initial preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    if (user && 'Notification' in window) {
      Notification.requestPermission();
      const socket = io('https://smart-service2.onrender.com');
      socket.on('booking_notification', (data) => {
         if (data.providerId === user.id || data.userId === user.id) {
            setNotificationCount(prev => prev + 1);
            if (Notification.permission === 'granted') {
               new Notification('Smart Service Alert', { body: data.message });
            }
         }
      });
      return () => socket.disconnect();
    }
  }, [user]);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const changeLanguage = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4 border-b border-gray-200 shadow-sm">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-2xl">
          <Wrench size={28} />
          {t('Smart Service')}
        </Link>
        
        <div className="flex items-center gap-6">
          <Link to="/services" className="text-main font-medium hover:text-primary transition-colors">
            {t('Explore Services')}
          </Link>
          
          <div className="flex items-center gap-2 relative">
             <Globe size={16} className="text-muted" />
             <select onChange={changeLanguage} value={i18n.language} className="bg-transparent text-sm font-medium outline-none text-main cursor-pointer dark:bg-slate-800 rounded">
                <option value="en">EN</option>
                <option value="te">TE</option>
                <option value="hi">HI</option>
             </select>
          </div>

          {!user ? (
            <div className="flex items-center gap-4">
              <button onClick={toggleDarkMode} className="text-muted hover:text-primary transition-colors">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <Link to="/login" className="btn btn-outline text-sm">{t('Log In')}</Link>
              <Link to="/register" className="btn btn-primary text-sm">{t('Sign Up')}</Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <button onClick={toggleDarkMode} className="text-muted hover:text-primary transition-colors">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <div className="relative cursor-pointer">
                 <Bell size={20} className="text-muted hover:text-primary transition-colors" />
                 {notificationCount > 0 && (
                   <span className="absolute -top-1 -right-1 flex h-3 w-3">
                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                     <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] items-center justify-center text-white font-bold">{notificationCount}</span>
                   </span>
                 )}
              </div>

              {user.role === 'user' && (
                <Link to="/my-bookings" className="flex items-center gap-1 text-muted hover:text-primary">
                  <CalendarDays size={20} />
                  <span className="text-sm font-medium">{t('Bookings')}</span>
                </Link>
              )}
              {user.role === 'provider' && (
                <Link to="/provider" className="flex items-center gap-1 text-muted hover:text-primary">
                  <LayoutDashboard size={20} />
                  <span className="text-sm font-medium">{t('Dashboard')}</span>
                </Link>
              )}
              {user.role === 'admin' && (
                <Link to="/admin" className="flex items-center gap-1 text-muted hover:text-primary">
                  <LayoutDashboard size={20} />
                  <span className="text-sm font-medium">{t('Admin Panel')}</span>
                </Link>
              )}
              
              <div className="h-8 w-[1px] bg-border mx-2"></div>
              
              <div className="flex items-center gap-2 text-sm font-medium">
                <User size={18} className="text-secondary" />
                {user.name}
              </div>
              <button onClick={handleLogout} className="text-danger hover:text-red-700 ml-4" title="Logout">
                <LogOut size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
