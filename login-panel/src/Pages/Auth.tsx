import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useHistory, useLocation } from 'react-router-dom';
import { API } from 'Plugins/CommonUtils/API';
import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage';
import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage';
import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage';
import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage';
import { UserDeleteMessage } from 'Plugins/PatientAPI/UserDeleteMessage';
import { AllUsersQueryMessage } from 'Plugins/PatientAPI/AllUsersQueryMessage';
import { useUser } from './UserContext';
import './Auth.css';

export function Auth() {
    const history = useHistory();
    const { username: contextUsername, isAdmin: contextIsAdmin, setUser, clearUser } = useUser();
    const [username, setUsername] = useState(contextUsername || '');
    const [password, setPassword] = useState('');
    const [isAdmin, setIsAdmin] = useState(contextIsAdmin);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(!!contextUsername);
    const [isLoading, setIsLoading] = useState(false);
    const [users, setUsers] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({ username: '', password: '' });
    const [touched, setTouched] = useState({ username: false, password: false });
    const location = useLocation<{ action: 'login' | 'register' }>();

    const resetState = useCallback(() => {
        setUsername('');
        setPassword('');
        setIsAdmin(false);
        setIsRegistering(false);
        setMessage('');
    }, []);

    useEffect(() => {
        return () => {
            resetState();
        };
    }, [resetState]);
    useEffect(() => {
        if (location.state?.action) {
            setIsRegistering(location.state.action === 'register');
        }
    }, [location]);

    const sendPostRequest = async (apiMessage: API) => {
        setIsLoading(true);
        setMessage('');
        try {
            const response = await axios.post(apiMessage.getURL(), JSON.stringify(apiMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);
            handleSuccessResponse(apiMessage, response.data);
            return response;
        } catch (error) {
            handleErrorResponse(apiMessage, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessResponse = (apiMessage: API, data: any) => {
        if (apiMessage instanceof RegisterMessage || apiMessage instanceof PatientRegisterMessage) {
            setMessage('注册成功');
            setIsRegistering(false);
        } else if (apiMessage instanceof LoginMessage || apiMessage instanceof PatientLoginMessage) {
            if (data === "Valid user") {
                setMessage('登录成功');
                setIsLoggedIn(true);
                setUser(username, isAdmin);
            } else {
                setMessage('登录失败：用户名或密码错误');
            }
        } else if (apiMessage instanceof UserDeleteMessage) {
            setMessage(`用户删除成功`);
            fetchUsers();
        } else if (apiMessage instanceof AllUsersQueryMessage) {
            if (Array.isArray(data)) {
                setUsers(data);
                if (data.length === 0) {
                    setMessage('没有找到任何用户');
                } else {
                    setMessage('');
                }
            } else {
                console.error('Received unexpected data format:', data);
                setMessage('获取用户列表失败：返回数据格式不正确');
            }
        }
    };

    const handleErrorResponse = (apiMessage: API, error: any) => {
        console.error('Operation failed:', error);
        if (axios.isAxiosError(error) && error.response) {
            const errorData = error.response.data;
            const errorMessage = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);

            if (apiMessage instanceof RegisterMessage || apiMessage instanceof PatientRegisterMessage) {
                if (errorMessage.includes('invalid user') || error.response.status === 500) {
                    setMessage('该用户名已被注册，请选择其他用户名');
                } else {
                    setMessage('注册失败，请稍后重试');
                }
            } else if (apiMessage instanceof LoginMessage || apiMessage instanceof PatientLoginMessage) {
                if (errorMessage === "Invalid user") {
                    setMessage('用户不存在，请检查用户名');
                } else {
                    setMessage('登录失败：用户名或密码错误');
                }
            } else if (apiMessage instanceof UserDeleteMessage) {
                setMessage('删除用户失败，请确认用户名是否正确');
            } else if (apiMessage instanceof AllUsersQueryMessage) {
                setMessage('获取用户列表失败，请稍后重试');
            } else {
                setMessage(`操作失败: ${errorMessage}`);
            }
        } else {
            setMessage('网络错误，请检查您的连接并重试');
        }
    };

    const validateField = (field: 'username' | 'password', value: string) => {
        if (!value.trim()) {
            return `请输入${field === 'username' ? '用户名' : '密码'}`;
        }
        return '';
    };

    const toggleAuthMode = () => {
        setIsRegistering(!isRegistering);
        setErrors({ username: '', password: '' });
        setTouched({ username: false, password: false });
        setMessage('');
    };

    const handleInputChange = (field: 'username' | 'password', value: string) => {
        if (field === 'username') {
            setUsername(value);
        } else {
            setPassword(value);
        }

        if (touched[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: validateField(field, value)
            }));
        }
    };

    const handleBlur = (field: 'username' | 'password') => {
        setTouched(prev => ({ ...prev, [field]: true }));
        setErrors(prev => ({
            ...prev,
            [field]: validateField(field, field === 'username' ? username : password)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ username: true, password: true });

        const usernameError = validateField('username', username);
        const passwordError = validateField('password', password);

        setErrors({ username: usernameError, password: passwordError });

        if (usernameError || passwordError) {
            return;
        }

        let apiMessage: API;
        if (isAdmin) {
            apiMessage = isRegistering ? new RegisterMessage(username, password) : new LoginMessage(username, password);
        } else {
            apiMessage = isRegistering ? new PatientRegisterMessage(username, password) : new PatientLoginMessage(username, password);
        }
        await sendPostRequest(apiMessage);
    };

    const fetchUsers = useCallback(async () => {
        if (isAdmin) {
            await sendPostRequest(new AllUsersQueryMessage());
        }
    }, [isAdmin]);

    useEffect(() => {
        if (isLoggedIn && isAdmin) {
            fetchUsers();
        }
    }, [isLoggedIn, isAdmin, fetchUsers]);

    const handleDeleteUser = async (userToDelete: string) => {
        if (window.confirm(`确定要删除用户 ${userToDelete} 吗？`)) {
            await sendPostRequest(new UserDeleteMessage(userToDelete));
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        clearUser();
        resetState();
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                {!isLoggedIn ? (
                    <>
                        <h2 className="auth-title">
                            {isRegistering ? '注册' : '登录'}
                        </h2>
                        {message && <div className="error-message">{message}</div>}
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-group">
                                <label htmlFor="username">用户名</label>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => handleInputChange('username', e.target.value)}
                                    onBlur={() => handleBlur('username')}
                                    className={touched.username && errors.username ? 'error' : ''}
                                    disabled={isLoading}
                                />
                                {touched.username && errors.username && <span className="error-message">{errors.username}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">密码</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => handleInputChange('password', e.target.value)}
                                    onBlur={() => handleBlur('password')}
                                    className={touched.password && errors.password ? 'error' : ''}
                                    disabled={isLoading}
                                />
                                {touched.password && errors.password && <span className="error-message">{errors.password}</span>}
                            </div>
                            <div className="checkbox-group">
                                <input
                                    id="isAdmin"
                                    type="checkbox"
                                    checked={isAdmin}
                                    onChange={(e) => setIsAdmin(e.target.checked)}
                                    disabled={isLoading}
                                />
                                <label htmlFor="isAdmin">管理员账户</label>
                            </div>
                            <button type="submit" className="submit-button" disabled={isLoading}>
                                {isLoading ? '处理中...' : (isRegistering ? '注册' : '登录')}
                            </button>
                            <div className="toggle-auth-mode">
                                <button type="button" onClick={toggleAuthMode} disabled={isLoading}>
                                    {isRegistering ? '已有账户？立即登录' : '没有账户？立即注册'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h2 className="auth-title">欢迎, {username}!</h2>
                        {isAdmin && (
                            <div className="user-management">
        <span className="caption-container">
            <span className="table-title">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                用户列表
            </span>
            <span className="table-row-count">({users.length} 用户)</span>
        </span>
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                        <tr>
                                            <th className="sticky-left">用户名</th>
                                            <th className="sticky-right"></th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {users.map(user => (
                                            <tr key={user}>
                                                <td className="user-name sticky-left">{user}</td>
                                                <td className="sticky-right">
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        className="delete-button"
                                                        disabled={isLoading}
                                                    >
                                                        删除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        <button onClick={handleLogout} className="logout-button" disabled={isLoading}>登出</button>
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