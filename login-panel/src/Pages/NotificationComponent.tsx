import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheckCircle, faEdit } from '@fortawesome/free-solid-svg-icons';
import { useUser } from './UserContext';
import { getUserCourseChanges, CourseChange } from 'Plugins/CourseAPI/CourseChanges';
import './NotificationComponent.css';

interface NotificationProps {
    count?: number;
}

interface Notification {
    id: string;
    courseId: string;
    courseTitle: string;
    changeType: string;
}

const NotificationComponent: React.FC<NotificationProps> = ({ count = 0 }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const { username } = useUser();

    useEffect(() => {
        if (username) {
            fetchCourseChanges();
        }
    }, [username]);

    const fetchCourseChanges = async () => {
        if (!username) return;
        try {
            const changes = await getUserCourseChanges(username);
            const newNotifications = changes.map(change => ({
                id: `${change.courseId}-${change.changeType}`,
                courseId: change.courseId,
                courseTitle: change.courseTitle,
                changeType: change.changeType
            }));
            setNotifications(newNotifications);
        } catch (error) {
            console.error('Error fetching course changes:', error);
        }
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!(event.target as Element).closest('.notification-wrapper')) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    return (
        <div className="notification-wrapper">
            <div className="notification-icon-wrapper" onClick={toggleDropdown}>
                <FontAwesomeIcon icon={faBell} className="notification-icon" />
                {notifications.length > 0 && (
                    <span className="notification-badge">{notifications.length}</span>
                )}
            </div>
            {showDropdown && (
                <div className="notification-dropdown">
                    <h3 className="notification-header">Notifications</h3>
                    {notifications.length > 0 ? (
                        <ul className="notification-list">
                            {notifications.map(notification => (
                                <li key={notification.id} className="notification-item">
                                    <FontAwesomeIcon
                                        icon={notification.changeType === 'update' ? faEdit : faCheckCircle}
                                        className={`notification-type-icon ${notification.changeType}`}
                                    />
                                    <div className="notification-content">
                                        <strong>{notification.courseTitle}</strong> has been {notification.changeType}d
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="no-notifications">No new notifications</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationComponent;