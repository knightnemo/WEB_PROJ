import React, { useState } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import { ChangePasswordMessage } from 'Plugins/DoctorAPI/ChangePasswordMessage';
import { PatientChangePasswordMessage } from 'Plugins/PatientAPI/PatientChangePasswordMessage';
import './ChangePassword.css';

export function ChangePassword() {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const sendPostRequest = async (apiMessage: ChangePasswordMessage | PatientChangePasswordMessage) => {
        setIsLoading(true);
        setMessage('');
        try {
            const response = await axios.post(apiMessage.getURL(), JSON.stringify(apiMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Response status:', response.status);
            console.log('Response body:', response.data);
            if (response.data === "Password changed successfully") {
                setMessage('密码修改成功');
                setTimeout(() => history.push(`/user/${username}`), 2000);
            } else {
                setMessage('密码修改失败，请重试');
            }
        } catch (error) {
            console.error('Operation failed:', error);
            setMessage('操作失败，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage('新密码和确认密码不匹配');
            return;
        }
        let apiMessage;
        if (isAdmin) {
            apiMessage = new ChangePasswordMessage(username, oldPassword, newPassword);
        } else {
            apiMessage = new PatientChangePasswordMessage(username, oldPassword, newPassword);
        }
        await sendPostRequest(apiMessage);
    };

    const handleUserButtonClick = () => {
        if (isAdmin) {
            history.push('/admin-dashboard');
        } else {
            history.push(`/user/${username}`);
        }
    };

    return (
        <div className="change-password-container">
            <div className="change-password-card">
                <h2 className="change-password-title">修改密码</h2>
                <form onSubmit={handleSubmit} className="change-password-form">
                    <div className="form-group">
                        <label htmlFor="oldPassword">旧密码</label>
                        <input
                            id="oldPassword"
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="newPassword">新密码</label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">确认新密码</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    {message && <div className="message">{message}</div>}
                    <button type="submit" className="submit-button" disabled={isLoading}>
                        {isLoading ? '处理中...' : '修改密码'}
                    </button>
                </form>
                <button
                    onClick={handleUserButtonClick}
                    className="back-button"
                    disabled={isLoading}
                >
                    返回个人主页
                </button>
            </div>
        </div>
    );
}