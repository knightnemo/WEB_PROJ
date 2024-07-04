import React, { useState, useEffect } from 'react';
import axios, { isAxiosError } from 'axios';
import { useHistory } from 'react-router-dom';
import { API } from 'Plugins/CommonUtils/API';
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage';
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage';
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage';
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage';
import './Auth.css';

export function Auth() {
    const history = useHistory();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [users, setUsers] = useState<string[]>([]);

    useEffect(() => {
        if (isAdmin && isLoggedIn) {
            fetchUsers();
        }
    }, [isAdmin, isLoggedIn]);

    const fetchUsers = async () => {
        try {
            const response = await axios.post('/api/UserQueryMessage', {});
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const sendPostRequest = async (message: API) => {
        try {
            const response = await axios.post(message.getURL(), JSON.stringify(message), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);
            alert('操作成功');
            setIsLoggedIn(true);
            if (isAdmin) {
                fetchUsers();
            }
        } catch (error) {
            if (isAxiosError(error)) {
                if (error.response && error.response.data) {
                    console.error('Error sending request:', error.response.data);
                    alert(`操作失败: ${error.response.data}`);
                } else {
                    console.error('Error sending request:', error.message);
                    alert(`操作失败: ${error.message}`);
                }
            } else {
                console.error('Unexpected error:', error);
                alert('操作失败: 未知错误');
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isAdmin) {
            if (isRegistering) {
                sendPostRequest(new RegisterMessage(username, password));
            } else {
                sendPostRequest(new LoginMessage(username, password));
            }
        } else {
            if (isRegistering) {
                sendPostRequest(new PatientRegisterMessage(username, password));
            } else {
                sendPostRequest(new PatientLoginMessage(username, password));
            }
        }
    };

    const handleDeleteUser = async (userName: string) => {
        try {
            await axios.post('/api/UserDeleteMessage', { userName });
            alert(`用户 ${userName} 已删除`);
            fetchUsers();
        } catch (error) {
            alert('删除用户失败');
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setUsername('');
        setPassword('');
        setUsers([]);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                {!isLoggedIn ? (
                    <>
                        <h2 className="auth-title">
                            {isRegistering ? '注册' : '登录'}
                        </h2>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="username">用户名</label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">密码</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="checkbox-group">
                                <input
                                    id="isAdmin"
                                    type="checkbox"
                                    checked={isAdmin}
                                    onChange={(e) => setIsAdmin(e.target.checked)}
                                />
                                <label htmlFor="isAdmin">管理员账户</label>
                            </div>
                            <button type="submit" className="submit-button">
                                {isRegistering ? '注册' : '登录'}
                            </button>
                        </form>
                        <div className="toggle-auth-mode">
                            <button onClick={() => setIsRegistering(!isRegistering)}>
                                {isRegistering ? '已有账户？立即登录' : '没有账户？立即注册'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="auth-title">
                            欢迎, {username}!
                        </h2>
                        {isAdmin && (
                            <div className="user-list">
                                <h3>用户列表</h3>
                                <ul>
                                    {users.map((user) => (
                                        <li key={user}>
                                            <span>{user}</span>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="delete-button"
                                            >
                                                删除
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="logout-button"
                        >
                            登出
                        </button>
                    </>
                )}
                <button
                    onClick={() => history.push("/")}
                    className="home-button"
                >
                    返回主页
                </button>
            </div>
        </div>
    );
}