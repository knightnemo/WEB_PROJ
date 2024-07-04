import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const Auth: React.FC = () => {
    const history = useHistory();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();

        try {
            // 假设登录API返回成功时，返回一个包含用户名的响应
            const response = await axios.post('http://localhost:8080/api/login', { username, password });
            localStorage.setItem('username', response.data.username);
            localStorage.setItem('isLoggedIn', 'true');
            history.push('/');
        } catch (error) {
            setMessage('登录失败，请检查用户名和密码');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">登录</h2>
                <form onSubmit={handleLogin} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">用户名:</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">密码:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="submit-button">登录</button>
                </form>
                {message && <p>{message}</p>}
            </div>
        </div>
    );
};

export default Auth;
