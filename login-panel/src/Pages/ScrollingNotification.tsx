import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
import './ScrollingNotification.css';
import axios from 'axios';
import { GetUserNotificationsMessage } from 'Plugins/NotificationAPI/GetUserNotificationsMessage';
import { useUser } from './UserContext';

interface Notification {
    id: string;
    title: string;
    content: string;
}

const ScrollingNotification: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const history = useHistory();
    const { username } = useUser();

    useEffect(() => {
        fetchNotifications();
    }, [username]);

    const fetchNotifications = async () => {
        try {
            const message = new GetUserNotificationsMessage(username);
            const response = await axios.post(message.getURL(), message.toJSON());

            let parsedNotifications;
            if (typeof response.data === 'string') {
                const cleanedData = response.data.slice(5, -1).trim();
                parsedNotifications = JSON.parse(`[${cleanedData}]`);
            } else {
                parsedNotifications = response.data;
            }

            setNotifications(parsedNotifications);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    const handleViewDetails = () => {
        history.push('/notifications');
    };

    return (
        <div className="scrolling-notification-container">
            <div className="scrolling-notification">
                <FontAwesomeIcon icon={faBell} className="notification-icon" />
                <div className="notification-content">
                    <div className="scrolling-text">
                        {notifications.map((notification) => (
                            <div key={notification.id} className="notification-item">
                                <div className="notification-title">{notification.title}</div>
                                <div className="notification-body">{notification.content.substring(0, 50)}...</div>
                            </div>
                        ))}
                    </div>
                </div>
                <button className="view-details-button" onClick={handleViewDetails}>
                    详情
                </button>
            </div>
        </div>
    );
};

export default ScrollingNotification;