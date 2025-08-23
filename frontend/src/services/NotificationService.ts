/**
 * NotificationService - Centralized notification and toast management
 */

export interface NotificationOptions {
  duration?: number;
  type?: 'success' | 'error' | 'warning' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export class NotificationService {
  private static instance: NotificationService;
  private notifications: Array<{
    id: string;
    message: string;
    options: NotificationOptions;
    timestamp: number;
  }> = [];
  private listeners: Array<(notifications: typeof this.notifications) => void> =
    [];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Show a notification
   */
  show(message: string, options: NotificationOptions = {}): string {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const notification = {
      id,
      message,
      options: {
        duration: 5000,
        type: 'info' as const,
        ...options,
      },
      timestamp: Date.now(),
    };

    this.notifications.push(notification);
    this.notifyListeners();

    // Auto-remove after duration
    if (notification.options.duration && notification.options.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, notification.options.duration);
    }

    return id;
  }

  /**
   * Show success notification
   */
  success(
    message: string,
    options?: Omit<NotificationOptions, 'type'>
  ): string {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * Show error notification
   */
  error(message: string, options?: Omit<NotificationOptions, 'type'>): string {
    return this.show(message, { ...options, type: 'error', duration: 0 }); // Errors don't auto-dismiss
  }

  /**
   * Show warning notification
   */
  warning(
    message: string,
    options?: Omit<NotificationOptions, 'type'>
  ): string {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * Show info notification
   */
  info(message: string, options?: Omit<NotificationOptions, 'type'>): string {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    this.notifications = [];
    this.notifyListeners();
  }

  /**
   * Get all notifications
   */
  getAll() {
    return [...this.notifications];
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(
    listener: (notifications: typeof this.notifications) => void
  ): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.notifications]);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }
}

export const notificationService = NotificationService.getInstance();
