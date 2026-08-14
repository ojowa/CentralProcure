'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Bell, Mail, Info, Shield, CheckCircle, RefreshCcw } from 'lucide-react';
import { fetchInternalNotifications, markInternalNotificationAsRead, markAllNotificationsAsRead } from '../../services/internalAuthService';
import type { InternalNotificationResult } from '../../types/internal';

interface NotificationBellProps {
  token: string | null;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ token }) => {
  const [notifications, setNotifications] = useState<InternalNotificationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.IsRead).length;

  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchInternalNotifications(token, 10);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(loadNotifications, 120000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    try {
      await markInternalNotificationAsRead(token, id);
      setNotifications(prev => prev.map(n => n.NotificationId === id ? { ...n, IsRead: true } : n));
      window.dispatchEvent(new CustomEvent('notification:read'));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token) return;
    const unreadCount = notifications.filter(n => !n.IsRead).length;
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsAsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: true })));
      window.dispatchEvent(new CustomEvent('notification:read'));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'RoleUpdate': return <Shield size={16} className="text-emerald-500" />;
      case 'Security': return <Shield size={16} className="text-rose-500" />;
      case 'Workflow': return <RefreshCcw size={16} className="text-blue-500" />;
      default: return <Info size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        type="button" 
        className="portal-notification-btn" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--portal-header-fg)',
          padding: '8px',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: 'var(--portal-accent)',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--portal-header-bg)'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          width: '320px',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          marginTop: '10px',
          zIndex: 1000,
          border: '1px solid var(--portal-border)',
          overflow: 'hidden'
        }}>
          <header style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--portal-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--portal-bg)'
          }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Notifications</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.7rem',
                    color: 'var(--portal-accent)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    padding: 0
                  }}
                >
                  Mark all read
                </button>
              )}
              {loading && <RefreshCcw size={14} className="animate-spin text-slate-400" />}
            </div>
          </header>

          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--portal-slate)', fontSize: '0.85rem' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.NotificationId}
                  onClick={() => !n.IsRead && handleMarkAsRead(n.NotificationId)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--portal-border)',
                    cursor: 'pointer',
                    background: n.IsRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                    transition: 'background 0.2s',
                    display: 'flex',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--portal-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.IsRead ? 'transparent' : 'rgba(16, 185, 129, 0.05)')}
                >
                  <div style={{ marginTop: '2px' }}>{getIcon(n.NotificationType)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: n.IsRead ? 500 : 700, marginBottom: '2px' }}>{n.Title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--portal-slate)', lineHeight: 1.4 }}>{n.Message}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--portal-slate)', marginTop: '4px', opacity: 0.7 }}>
                      {new Date(n.CreatedAt).toLocaleString()}
                    </div>
                  </div>
                  {!n.IsRead && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--portal-accent)', marginTop: '6px' }} />
                  )}
                </div>
              ))
            )}
          </div>

          <footer style={{
            padding: '8px',
            textAlign: 'center',
            borderTop: '1px solid var(--portal-border)',
            background: 'var(--portal-bg)'
          }}>
            <button 
              onClick={loadNotifications}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '0.75rem',
                color: 'var(--portal-accent)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              Refresh
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};
