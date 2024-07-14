import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import './ScrollingNotification.css';

interface Notification {
    id: number;
    content: string;
}

const ScrollingNotification: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const history = useHistory();

    useEffect(() => {
        // 模拟从API获取通知
        const fetchNotifications = async () => {
            // 这里应该是一个实际的API调用
            const mockNotifications = [
                { id: 1, content: "Python进阶课程现已开放报名，限时优惠！" },
                { id: 2, content: "本周六凌晨2-4点系统进行例行维护，请提前安排学习时间。" },
                { id: 3, content: "Java基础课程已更新至2023版，包含最新特性讲解。" },
            ];
            setNotifications(mockNotifications);
        };

        fetchNotifications();
    }, []);

    const handleViewDetails = () => {
        // 跳转到通知页面
        history.push('/notifications');
    };

    return (
        <div className="scrolling-notification-container">
            <div className="scrolling-notification">
                <div className="notification-icon">
                    <FontAwesomeIcon icon={faLink} />
                </div>
                <div className="notification-content">
                    {notifications.map((notification) => (
                        <span key={notification.id} className="notification-item">
                            {notification.content}
                        </span>
                    ))}
                </div>
                <button className="view-details-button" onClick={handleViewDetails}>
                    详情
                </button>
            </div>
        </div>
    );
};

export default ScrollingNotification;