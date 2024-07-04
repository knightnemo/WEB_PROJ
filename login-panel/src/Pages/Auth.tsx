// import React, { useState, useEffect, useCallback } from 'react';
// import axios, { isAxiosError } from 'axios';
// import { useHistory } from 'react-router-dom';
// import { API } from 'Plugins/CommonUtils/API';
// import { LoginMessage } from 'Plugins/DoctorAPI/LoginMessage';
// import { RegisterMessage } from 'Plugins/DoctorAPI/RegisterMessage';
// import { PatientLoginMessage } from 'Plugins/PatientAPI/PatientLoginMessage';
// import { PatientRegisterMessage } from 'Plugins/PatientAPI/PatientRegisterMessage';
// import { UserDeleteMessage } from 'Plugins/DoctorAPI/UserDeleteMessage';
// import './Auth.css';
//
// export function Auth() {
//     const history = useHistory();
//     const [username, setUsername] = useState('');
//     const [password, setPassword] = useState('');
//     const [isAdmin, setIsAdmin] = useState(false);
//     const [isRegistering, setIsRegistering] = useState(false);
//     const [isLoggedIn, setIsLoggedIn] = useState(false);
//     const [userToDelete, setUserToDelete] = useState('');
//
//     const resetState = useCallback(() => {
//         setUsername('');
//         setPassword('');
//         setIsAdmin(false);
//         setIsRegistering(false);
//         setUserToDelete('');
//     }, []);
//
//     useEffect(() => {
//         return () => {
//             resetState();
//         };
//     }, [resetState]);
//
//     const sendPostRequest = async (message: API) => {
//         try {
//             const response = await axios.post(message.getURL(), JSON.stringify(message), {
//                 headers: { 'Content-Type': 'application/json' },
//             });
//             console.log('Response status:', response.status);
//             console.log('Response body:', response.data);
//             alert('操作成功');
//             setIsLoggedIn(true);
//         } catch (error) {
//             if (isAxiosError(error)) {
//                 if (error.response && error.response.data) {
//                     console.error('Error sending request:', error.response.data);
//                     alert(`操作失败: ${error.response.data}`);
//                 } else {
//                     console.error('Error sending request:', error.message);
//                     alert(`操作失败: ${error.message}`);
//                 }
//             } else {
//                 console.error('Unexpected error:', error);
//                 alert('操作失败: 未知错误');
//             }
//         }
//     };
//
//     const handleSubmit = (e: React.FormEvent) => {
//         e.preventDefault();
//         if (isAdmin) {
//             if (isRegistering) {
//                 sendPostRequest(new RegisterMessage(username, password));
//             } else {
//                 sendPostRequest(new LoginMessage(username, password));
//             }
//         } else {
//             if (isRegistering) {
//                 sendPostRequest(new PatientRegisterMessage(username, password));
//             } else {
//                 sendPostRequest(new PatientLoginMessage(username, password));
//             }
//         }
//     };
//
//     const handleDeleteUser = async () => {
//         if (!userToDelete) {
//             alert('请输入要删除的用户名');
//             return;
//         }
//         try {
//             await sendPostRequest(new UserDeleteMessage(userToDelete));
//             alert(`用户 ${userToDelete} 已删除`);
//             setUserToDelete('');
//         } catch (error) {
//             alert('删除用户失败');
//         }
//     };
//
//     const handleLogout = () => {
//         setIsLoggedIn(false);
//         resetState();
//     };
//
//     return (
//         <div className="auth-container">
//             <div className="auth-card">
//                 {!isLoggedIn ? (
//                     <>
//                         <h2 className="auth-title">
//                             {isRegistering ? '注册' : '登录'}
//                         </h2>
//                         <form onSubmit={handleSubmit} className="auth-form">
//                             <div className="form-group">
//                                 <label htmlFor="username">用户名</label>
//                                 <input
//                                     id="username"
//                                     type="text"
//                                     value={username}
//                                     onChange={(e) => setUsername(e.target.value)}
//                                     required
//                                 />
//                             </div>
//                             <div className="form-group">
//                                 <label htmlFor="password">密码</label>
//                                 <input
//                                     id="password"
//                                     type="password"
//                                     value={password}
//                                     onChange={(e) => setPassword(e.target.value)}
//                                     required
//                                 />
//                             </div>
//                             <div className="checkbox-group">
//                                 <input
//                                     id="isAdmin"
//                                     type="checkbox"
//                                     checked={isAdmin}
//                                     onChange={(e) => setIsAdmin(e.target.checked)}
//                                 />
//                                 <label htmlFor="isAdmin">管理员账户</label>
//                             </div>
//                             <button type="submit" className="submit-button">
//                                 {isRegistering ? '注册' : '登录'}
//                             </button>
//                         </form>
//                         <div className="toggle-auth-mode">
//                             <button onClick={() => setIsRegistering(!isRegistering)}>
//                                 {isRegistering ? '已有账户？立即登录' : '没有账户？立即注册'}
//                             </button>
//                         </div>
//                     </>
//                 ) : (
//                     <>
//                         <h2 className="auth-title">
//                             欢迎, {username}!
//                         </h2>
//                         {isAdmin && (
//                             <div className="user-management">
//                                 <h3>删除用户</h3>
//                                 <div className="form-group">
//                                     <input
//                                         type="text"
//                                         value={userToDelete}
//                                         onChange={(e) => setUserToDelete(e.target.value)}
//                                         placeholder="输入要删除的用户名"
//                                     />
//                                     <button onClick={handleDeleteUser} className="delete-button">
//                                         删除用户
//                                     </button>
//                                 </div>
//                             </div>
//                         )}
//                         <button
//                             onClick={handleLogout}
//                             className="logout-button"
//                         >
//                             登出
//                         </button>
//                     </>
//                 )}
//                 <button
//                     onClick={() => history.push("/")}
//                     className="home-button"
//                 >
//                     返回主页
//                 </button>
//             </div>
//         </div>
//     );
// }

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

            // 检查响应体是否包含 "invalid user"
            if (typeof response.data === 'string' && response.data.toLowerCase().includes('invalid user')) {
                throw new Error('Invalid user');
            }

            if (response.status >= 200 && response.status < 300) {
                await handleSuccessResponse(message, response.data);
            } else {
                handleErrorResponse(new Error(response.data));
            }
        } catch (error) {
            handleErrorResponse(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuccessResponse = async (message: API, data: any) => {
        if (message instanceof RegisterMessage || message instanceof PatientRegisterMessage) {
            console.log('Registration successful');
            alert('注册成功');
            setIsRegistering(false);
        } else if (message instanceof LoginMessage || message instanceof PatientLoginMessage) {
            // 检查登录响应是否表示成功（包含 "Valid user"）
            if (typeof data === 'string' && data.toLowerCase().includes('valid user')) {
                console.log('Login successful');
                alert('登录成功');
                setIsLoggedIn(true);
            } else {
                console.log('Login failed');
                alert('登录失败：用户名或密码错误');
            }
        } else if (message instanceof UserDeleteMessage) {
            if (data.success) {
                alert(`用户 ${message.userName} 已成功删除`);
                setUserToDelete('');
            } else {
                alert(`删除用户 ${message.userName} 失败：${data.message}`);
            }
        }
    };

    const handleErrorResponse = (error: any) => {
        console.error('Operation failed:', error);

        if (isAxiosError(error)) {
            if (error.response) {
                const statusCode = error.response.status;
                const errorMessage = error.response.data?.message || error.message || '未知错误';

                switch (statusCode) {
                    case 400:
                        alert(`请求错误: ${errorMessage}`);
                        break;
                    case 401:
                        alert('权限不足，无法执行此操作。');
                        break;
                    case 404:
                        alert('用户不存在，请检查用户名。');
                        break;
                    case 500:
                        alert(`服务器错误: ${errorMessage}`);
                        break;
                    default:
                        alert(`操作失败: ${errorMessage}`);
                }
            } else if (error.request) {
                alert('无法连接到服务器，请检查您的网络连接。');
            } else {
                alert(`操作失败: ${error.message}`);
            }
        } else {
            alert('操作失败: 发生未知错误');
        }
    };

    const verifyUserDeletion = async (userName: string): Promise<boolean> => {
        try {
            // 尝试使用刚刚"删除"的用户名登录（使用一个占位符密码）
            const loginMessage = isAdmin
                ? new LoginMessage(userName, "placeholder_password")
                : new PatientLoginMessage(userName, "placeholder_password");

            const response = await axios.post(loginMessage.getURL(), JSON.stringify(loginMessage), {
                headers: { 'Content-Type': 'application/json' },
            });

            // 如果登录成功，说明用户没有被删除
            if (response.status >= 200 && response.status < 300) {
                console.log('User still exists, deletion might have failed');
                return false;
            }
        } catch (error) {
            // 如果登录失败（例如，返回 401 未授权），可能意味着用户已被删除
            console.log('Login failed, user might have been deleted successfully');
            return true;
        }

        return true; // 如果发生任何其他情况，我们假设删除成功
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
            const isDeleted = await verifyUserDeletion(userToDelete);
            if (isDeleted) {
                alert(`用户 ${userToDelete} 已成功删除`);
                setUserToDelete('');
            } else {
                alert(`无法确认用户 ${userToDelete} 是否已被删除，请检查系统`);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('删除用户失败');
        }
    };

    const handleLogout = () => {
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
