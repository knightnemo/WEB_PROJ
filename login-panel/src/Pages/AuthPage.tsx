import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

export function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const history = useHistory();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // 这里应该调用实际的登录或注册 API
        console.log(isLogin ? 'Logging in' : 'Registering', { email, password });
        // 假设认证成功，返回主页
        history.push('/');
    };

    return (
        <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md animate-fade-in-up">
                <h2 className="text-2xl font-bold mb-6 text-center">
                    {isLogin ? '登录' : '注册'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-gray-700 mb-2">邮箱</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-gray-700 mb-2">密码</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition duration-300 transform hover:scale-105"
                    >
                        {isLogin ? '登录' : '注册'}
                    </button>
                </form>
                <p className="mt-4 text-center">
                    {isLogin ? '还没有账号？' : '已有账号？'}
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-blue-500 hover:underline ml-1 transition duration-300"
                    >
                        {isLogin ? '注册' : '登录'}
                    </button>
                </p>
            </div>
        </div>
    );
}