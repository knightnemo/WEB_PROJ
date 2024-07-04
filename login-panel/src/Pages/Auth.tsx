import React, { useState, useEffect, useCallback } from 'react';
import axios, { isAxiosError } from 'axios';
import { useHistory } from 'react-router-dom';
import { API } from 'Plugins/CommonUtils/API';
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage';
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage';
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage';
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage';
import { UserDeleteMessage } from 'Plugins/DoctorAPI/UserDeleteMessage';
import './Auth.css';

export function Auth() {
    const history = useHistory();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userToDelete, setUserToDelete] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const resetState = useCallback(() => {
        setUsername('');
        setPassword('');
        setIsAdmin(false);
        setIsRegistering(false);
        setUserToDelete('');
    }, []);

    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);

    const sendPostRequest = async (message: API) => {
        setIsLoading(true);
        try {
            const response = await axios.post(message.getURL(), JSON.stringify(message), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);

            if (typeof response.data === 'string' && response.data.includes('Invalid user')) {
                handleErrorResponse(new Error('Invalid user'));
            } else if (response.status >= 200 && response.status < 300 && !response.data.includes('error')) {
                if (message instanceof RegisterMessage || message instanceof PatientRegisterMessage) {
                    console.log('Registration successful');
                    alert('注册成功');
                    setIsRegistering(false);
                } else if (message instanceof LoginMessage || message instanceof PatientLoginMessage) {
                    console.log('Login successful');
                    alert('登录成功');
                    setIsLoggedIn(true);
                    localStorage.setItem('username', username); // 存储用户名
                    history.push('/'); // 登录成功后跳转到主页
                } else if (message instanceof UserDeleteMessage) {
                    console.log(`User deletion attempt for: ${(message as UserDeleteMessage).userName}`);
                    alert(`用户 ${(message as UserDeleteMessage).userName} 已删除`);
                }
            } else {
                handleErrorResponse(new Error(response.data));
            }
        } catch (error) {
            handleErrorResponse(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleErrorResponse = (error: any) => {
        console.error('Operation failed:', error);

        if (isAxiosError(error)) {
            if (error.response) {
                const statusCode = error.response.status;
                const errorMessage = error.response.data?.message || '未知错误';

                switch (statusCode) {
                    case 401:
                        alert('用户名或密码错误，请重试。');
                        break;
                    case 404:
                        alert('用户不存在，请检查用户名。');
                        break;
                    default:
                        alert(`操作失败: ${errorMessage}`);
                }
            } else if (error.request) {
                alert('无法连接到服务器，请检查您的网络连接。');
            } else {
                alert(`操作失败: ${error.message}`);
            }
        } else if (error.message === 'Invalid user') {
            alert('用户名或密码错误，请重试。');
        } else {
            alert('操作失败: 发生未知错误');
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

    const handleDeleteUser = async () => {
        if (!userToDelete) {
            alert('请输入要删除的用户名');
            return;
        }
        try {
            await sendPostRequest(new UserDeleteMessage(userToDelete));
            setUserToDelete('');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('删除用户失败');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('username');
        setIsLoggedIn(false);
        resetState();
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                {isLoading ? (
                    <div className="loading">正在处理，请稍候...</div>
                ) : !isLoggedIn ? (
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
                            <button onClick={() => setIsRegistering(!isRegistering)} disabled={isLoading}>
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
                            <div className="user-management">
                                <h3>删除用户</h3>
                                <div className="form-group">
                                    <input
                                        type="text"
                                        value={userToDelete}
                                        onChange={(e) => setUserToDelete(e.target.value)}
                                        placeholder="输入要删除的用户名"
                                    />
                                    <button onClick={handleDeleteUser} className="delete-button">
                                        删除用户
                                    </button>
                                </div>
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
                    disabled={isLoading}
                >
                    返回主页
                </button>
            </div>
        </div>
    );
}