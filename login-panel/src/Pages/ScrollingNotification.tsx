import React, { useState, useEffect, useRef } from 'react';
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
    const handleBack = () => {
        history.goBack(); // 添加这个函数
    };
    const { username } = useUser();
    const scrollingTextRef = useRef<HTMLDivElement>(null);
    const [scrollPosition, setScrollPosition] = useState(0);

    useEffect(() => {
        fetchNotifications();
    }, [username]);

    useEffect(() => {
        const scrollingText = scrollingTextRef.current;
        if (scrollingText && notifications.length > 0) {
            const scroll = () => {
                setScrollPosition((prevPosition) => {
                    const maxScroll = scrollingText.scrollWidth / 2;
                    if (prevPosition >= maxScroll) {
                        return 0;
                    }
                    return prevPosition + 1;
                });
            };

            const animationId = setInterval(scroll, 30); // 调整此值以改变滚动速度

            return () => clearInterval(animationId);
        }
    }, [notifications]);

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
                <div className="notification-content-wrapper">
                    <div className="notification-content">
                        <div
                            className="scrolling-text"
                            ref={scrollingTextRef}
                            style={{ transform: `translateX(-${scrollPosition}px)` }}
                        >
                            {notifications.concat(notifications).map((notification, index) => (
                                <div key={`${notification.id}-${index}`} className="notification-item">
                                    <div className="notification-title">{notification.title}</div>
                                    <div className="notification-body">{notification.content.substring(0, 50)}...</div>
                                </div>
                            ))}
                        </div>
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