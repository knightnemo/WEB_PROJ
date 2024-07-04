import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import axios from 'axios';
import './ChangePassword.css';

const ChangePassword: React.FC = () => {
    const history = useHistory();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [username, setUsername] = useState('');
    const [showDialog, setShowDialog] = useState(false);

    useEffect(() => {
        const storedUsername = localStorage.getItem('username');
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        if (isLoggedIn === 'true' && storedUsername) {
            setUsername(storedUsername);
        } else {
            setShowDialog(true);
        }
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage('新密码和确认密码不匹配');
            return;
        }

        try {
            await axios.post('http://localhost:8080/api/changePassword', {
                oldPassword,
                newPassword,
            });
            setMessage('密码修改成功');
        } catch (error) {
            setMessage('修改密码时出错');
        }
    };

    const handleBack = () => {
        history.push('/');
    };

    const handleCloseDialog = () => {
        setShowDialog(false);
        history.push('/auth');
    };

    return (
        <div className="change-password-container">
            <h2>修改密码</h2>
            <p>当前用户: {username}</p>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="oldPassword">旧密码:</label>
                    <input
                        type="password"
                        id="oldPassword"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="newPassword">新密码:</label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="confirmPassword">确认密码:</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="submit-button">修改密码</button>
            </form>
            {message && <p className="message">{message}</p>}
            <button onClick={handleBack} className="back-button">返回</button>

            {showDialog && (
                <div className="dialog">
                    <div className="dialog-content">
                        <p>您尚未登录，无法修改密码。</p>
                        <button onClick={handleCloseDialog} className="dialog-button">去登录</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChangePassword;
