import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import './NotificationsPage.css';
import { GetUserNotificationsMessage } from 'Plugins/NotificationAPI/GetUserNotificationsMessage';
import { CreateNotificationMessage } from 'Plugins/NotificationAPI/CreateNotificationMessage';
import { GetAllNotificationsMessage } from 'Plugins/NotificationAPI/GetAllNotificationsMessage';
import { DeleteNotificationMessage } from 'Plugins/NotificationAPI/DeleteNotificationMessage';
import { useHistory } from 'react-router-dom';

interface Notification {
    id: string;
    title: string;
    content: string;
    publisher: string;
    publishTime: string;
    recipients: string[];
}

interface NewNotification {
    id: string;
    title: string;
    content: string;
    publisher: string;
    publishTime: string;
    recipients: string;
}

const NotificationsPage: React.FC = () => {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [message, setMessage] = useState('');
    const [newNotification, setNewNotification] = useState<NewNotification>({
        id: '',
        title: '',
        content: '',
        publisher: '',
        publishTime: '',
        recipients: ''
    });

    useEffect(() => {
        fetchNotifications();
    }, [isAdmin, username]);

    const fetchNotifications = async () => {
        try {
            const message = isAdmin ? new GetAllNotificationsMessage() : new GetUserNotificationsMessage(username);
            const response = await axios.post(message.getURL(), message.toJSON());

            let parsedNotifications = parseNotifications(response.data);
            setNotifications(parsedNotifications);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            setMessage('获取通知失败，请稍后重试');
            setNotifications([]);
        }
    };

    const parseNotifications = (data: any): Notification[] => {
        if (typeof data === 'string') {
            const cleanedData = data.slice(5, -1).trim();
            data = JSON.parse(`[${cleanedData}]`);
        }
        return Array.isArray(data) ? data.map(formatNotification) : [];
    };

    const formatNotification = (notification: any): Notification => ({
        ...notification,
        recipients: Array.isArray(notification.recipients)
            ? notification.recipients
            : notification.recipients.split(',').map((r: string) => r.trim())
    });

    const handlePublishNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const createMessage = new CreateNotificationMessage(
                generateId(),
                newNotification.title,
                newNotification.content,
                username,
                new Date().toISOString(),
                newNotification.recipients
            );
            const response = await axios.post(createMessage.getURL(), createMessage.toJSON());
            setMessage(response.data);
            resetNewNotification();
            fetchNotifications();
        } catch (error) {
            console.error('Failed to publish notification:', error);
            setMessage('发布公告失败，请稍后重试');
        }
    };

    const handleDeleteNotification = async (id: string) => {
        try {
            const deleteMessage = new DeleteNotificationMessage(id);
            const response = await axios.post(deleteMessage.getURL(), deleteMessage);
            setMessage(response.data);
            fetchNotifications();
        } catch (error) {
            console.error('Failed to delete notification:', error);
            setMessage('删除公告失败，请稍后重试');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewNotification(prev => ({ ...prev, [name]: value }));
    };

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    const resetNewNotification = () => {
        setNewNotification({
            id: '',
            title: '',
            content: '',
            publisher: '',
            publishTime: '',
            recipients: ''
        });
    };

    return (
        <div className="notifications-page">
            <h1>公告栏</h1>
            {message && <div className="message">{message}</div>}
            {isAdmin && (
                <div className="publish-notification">
                    <h2>发布新公告</h2>
                    <form onSubmit={handlePublishNotification}>
                        <input
                            type="text"
                            name="title"
                            value={newNotification.title}
                            onChange={handleInputChange}
                            placeholder="公告标题"
                            required
                        />
                        <textarea
                            name="content"
                            value={newNotification.content}
                            onChange={handleInputChange}
                            placeholder="公告内容"
                            required
                        />
                        <input
                            type="text"
                            name="recipients"
                            value={newNotification.recipients}
                            onChange={handleInputChange}
                            placeholder="接收者 (用逗号分隔，或输入 'all')"
                            required
                        />
                        <button type="submit">发布公告</button>
                    </form>
                </div>
            )}
            <div className="notifications-list">
                {notifications.map(notification => (
                    <div key={notification.id} className="notification-item">
                        <h2>{notification.title}</h2>
                        <p>{notification.content}</p>
                        <div className="notification-meta">
                            <span>发布者: {notification.publisher}</span>
                            <span>时间: {new Date(notification.publishTime).toLocaleString()}</span>
                            <span>接收者: {notification.recipients.join(', ')}</span>
                        </div>
                        {isAdmin && (
                            <button className="delete-button" onClick={() => handleDeleteNotification(notification.id)}>删除</button>
                        )}
                    </div>
                ))}
            </div>
            <div className="back-button-container">
                <button onClick={() => history.goBack()} className="back-button">返回</button>
            </div>
        </div>
    );
};

export default NotificationsPage;