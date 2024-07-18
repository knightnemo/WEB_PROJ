// StaticNotification.tsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import './StaticNotification.css';

interface Notification {
    id: number;
    content: string;
}

interface StaticNotificationProps {
    notifications: Notification[];
}

const StaticNotification: React.FC<StaticNotificationProps> = ({ notifications }) => {
    return (
        <div className="static-notification-container">
            {notifications.map((notification) => (
                <div key={notification.id} className="static-notification-item">
                    <div className="notification-icon">
                        <FontAwesomeIcon icon={faLink} />
                    </div>
                    <div className="notification-content">
                        {notification.content}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StaticNotification;