import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from './UserContext';
import './NotificationsPage.css';

interface Notification {
    id: string;
    title: string;
    content: string;
    publisher: string;
    publishTime: string;
    recipients: string[];
}

interface User {
    username: string;
    isAdmin: boolean;
}

const NotificationsPage: React.FC = () => {
    const { username, isAdmin } = useUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [newNotification, setNewNotification] = useState({ title: '', content: '', recipients: [] });
    const [message, setMessage] = useState('');
    const notificationsPerPage = 10;

    useEffect(() => {
        fetchNotifications();
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchNotifications = async () => {
        try {
            const response = await axios.get(`/api/notifications?username=${username}`);
            setNotifications(response.data);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            setMessage('获取通知失败，请稍后重试');
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setMessage('获取用户列表失败，请稍后重试');
        }
    };

    const handlePublishNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/notifications', newNotification);
            setMessage('公告发布成功');
            setNewNotification({ title: '', content: '', recipients: [] });
            fetchNotifications();
        } catch (error) {
            console.error('Failed to publish notification:', error);
            setMessage('发布公告失败，请稍后重试');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewNotification(prev => ({ ...prev, [name]: value }));
    };

    const handleRecipientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setNewNotification(prev => ({ ...prev, recipients: selectedOptions }));
    };

    const indexOfLastNotification = currentPage * notificationsPerPage;
    const indexOfFirstNotification = indexOfLastNotification - notificationsPerPage;
    const currentNotifications = notifications.slice(indexOfFirstNotification, indexOfLastNotification);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    return (
        <div className="notifications-page">
            <h1>公告</h1>
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
                        <select
                            multiple
                            value={newNotification.recipients}
                            onChange={handleRecipientChange}
                        >
                            {users.map(user => (
                                <option key={user.username} value={user.username}>
                                    {user.username} ({user.isAdmin ? '管理员' : '用户'})
                                </option>
                            ))}
                        </select>
                        <button type="submit">发布公告</button>
                    </form>
                </div>
            )}
            <div className="notifications-list">
                {currentNotifications.map(notification => (
                    <div key={notification.id} className="notification-item">
                        <h2>{notification.title}</h2>
                        <p>{notification.content}</p>
                        <div className="notification-meta">
                            <span>发布者: {notification.publisher}</span>
                            <span>时间: {notification.publishTime}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="pagination">
                {Array.from({ length: Math.ceil(notifications.length / notificationsPerPage) }, (_, i) => (
                    <button key={i} onClick={() => paginate(i + 1)}>
                        {i + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default NotificationsPage;