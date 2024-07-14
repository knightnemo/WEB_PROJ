import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';

interface NotificationProps {
    count?: number;
}

const NotificationComponent: React.FC<NotificationProps> = ({ count = 0 }) => {
    const [showDropdown, setShowDropdown] = useState(false);

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
            <div onClick={toggleDropdown}>
                <FontAwesomeIcon icon={faBell} className="notification-icon" />
                {count > 0 && <span className="notification-badge">{count}</span>}
            </div>
            {showDropdown && (
                <div className="notification-dropdown">
                    <div className="notification-item">
                        <strong>Jason Alexander</strong> completed <strong>Issue 131</strong>
                        <div className="time">6 min ago</div>
                    </div>
                    <div className="notification-item">
                        <strong>Michelle Claude</strong> opened a new <strong>Issue 152</strong>
                        <div className="time">8 min ago</div>
                    </div>
                    {/* Add more notification items as needed */}
                </div>
            )}
        </div>
    );
};

export default NotificationComponent;