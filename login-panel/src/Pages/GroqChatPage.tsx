import React, { useState } from 'react';
import axios from 'axios';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import './GroqChatPage.css';
import Groq from 'groq-sdk';

// 使用环境变量中的 API Key
const groq = new Groq({
    apiKey: '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',
    dangerouslyAllowBrowser: true
});

const GroqChatPage: React.FC = () => {
    const [input, setInput] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const history = useHistory();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: input,
                    },
                ],
                model: 'mixtral-8x7b-32768',
            });

            setResponse(completion.choices[0]?.message?.content || '无回答');
        } catch (error) {
            console.error('调用 Groq API 时出错:', error);
            setResponse('抱歉，发生了错误，请稍后再试。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="groq-chat-page">
            <header>
                <button onClick={() => history.goBack()} className="back-button">
                    <FontAwesomeIcon icon={faArrowLeft} /> 返回
                </button>
                <h1>问问 Groq</h1>
            </header>
            <div className="chat-container">
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="输入你的问题..."
                    />
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? '正在思考...' : '发送'}
                    </button>
                </form>
                {response && (
                    <div className="response">
                        <h3>Groq 的回答：</h3>
                        <p>{response}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroqChatPage;
