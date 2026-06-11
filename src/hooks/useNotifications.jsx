import { useState, useEffect, useRef } from 'react';
import { listenNotifications, deleteNotification } from '../appwrite/database';

export function useNotifications(userId) {
  const [dbNotifications, setDbNotifications] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`sjec_dismissed_notif_${userId || 'guest'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastSeenTime, setLastSeenTime] = useState(() => {
    return localStorage.getItem(`sjec_last_seen_notif_${userId || 'guest'}`) || '1970-01-01T00:00:00.000Z';
  });

  // Track pending dismisses (for the 5 second undo window)
  const [pendingDismissList, setPendingDismissList] = useState([]); // Array of { ids: [], timerId: num, type: 'single'|'clear_all', category: string }
  const pendingDismissListRef = useRef([]);
  pendingDismissListRef.current = pendingDismissList;

  // Real-time synchronization
  useEffect(() => {
    if (!userId) return;
    const unsub = listenNotifications(userId, (docs) => {
      // Sort newest first
      const sorted = [...docs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDbNotifications(sorted);
    });
    return unsub;
  }, [userId]);

  // Sync dismissed IDs to localStorage
  const saveDismissedIds = (ids) => {
    try {
      localStorage.setItem(`sjec_dismissed_notif_${userId || 'guest'}`, JSON.stringify(ids));
      setDismissedIds(ids);
    } catch (err) {
      console.warn("Failed to save dismissed notifications:", err);
    }
  };

  // Helper to check if a notification is currently dismissed (permanently or pending)
  const isDismissed = (notifId) => {
    if (dismissedIds.includes(notifId)) return true;
    return pendingDismissList.some(p => p.ids.includes(notifId));
  };

  // Filtered notifications list
  const visibleNotifications = dbNotifications.filter(n => !isDismissed(n.$id || n.id));

  // Unread badge count
  const unreadCount = visibleNotifications.filter(n => {
    const createdStr = n.createdAt || new Date().toISOString();
    return createdStr > lastSeenTime;
  }).length;

  // Clear unread badge
  const resetUnreadCount = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem(`sjec_last_seen_notif_${userId || 'guest'}`, nowStr);
    setLastSeenTime(nowStr);
  };

  // Dismiss a single notification with undo
  const dismissNotification = (id) => {
    const isPersonal = dbNotifications.find(n => (n.$id || n.id) === id)?.user_id === userId;

    // Create a 5-second timer
    const timerId = setTimeout(() => {
      // Permanent action: Add to dismissed list and delete personal ones from DB
      setPendingDismissList(prev => {
        const item = prev.find(p => p.timerId === timerId);
        if (item) {
          const updatedDismissed = [...dismissedIds, ...item.ids];
          saveDismissedIds(updatedDismissed);
          if (isPersonal) {
            deleteNotification(id).catch(err => console.warn("Failed to delete notification from DB:", err));
          }
        }
        return prev.filter(p => p.timerId !== timerId);
      });
    }, 5000);

    setPendingDismissList(prev => [
      ...prev,
      { ids: [id], timerId, type: 'single', label: 'Notification dismissed' }
    ]);
  };

  // Clear all notifications in a category with undo
  const clearAll = (category) => {
    const targetNotifs = visibleNotifications.filter(n => (n.category || 'college') === category);
    if (targetNotifs.length === 0) return;

    const idsToClear = targetNotifs.map(n => n.$id || n.id);
    const personalIds = targetNotifs.filter(n => n.user_id === userId).map(n => n.$id || n.id);

    const timerId = setTimeout(() => {
      setPendingDismissList(prev => {
        const item = prev.find(p => p.timerId === timerId);
        if (item) {
          const updatedDismissed = [...dismissedIds, ...item.ids];
          saveDismissedIds(updatedDismissed);
          // Delete personal ones in batch
          personalIds.forEach(pid => {
            deleteNotification(pid).catch(err => console.warn("Failed to delete cleared notification:", err));
          });
        }
        return prev.filter(p => p.timerId !== timerId);
      });
    }, 5000);

    setPendingDismissList(prev => [
      ...prev,
      { ids: idsToClear, timerId, type: 'clear_all', label: `Cleared all ${category} alerts` }
    ]);
  };

  // Undo pending dismisses
  const undoDismiss = (timerId) => {
    const item = pendingDismissList.find(p => p.timerId === timerId);
    if (item) {
      clearTimeout(item.timerId);
      setPendingDismissList(prev => prev.filter(p => p.timerId !== timerId));
    }
  };

  return {
    notifications: visibleNotifications,
    unreadCount,
    resetUnreadCount,
    dismissNotification,
    clearAll,
    pendingDismissList,
    undoDismiss
  };
}
