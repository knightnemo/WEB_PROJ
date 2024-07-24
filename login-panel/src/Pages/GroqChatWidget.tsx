import React, { useState, useEffect } from 'react';
import Groq from 'groq-sdk';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faComments } from '@fortawesome/free-solid-svg-icons';
//

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    category: string;
}
///knightnemo:这里又是真的api_key,咱们的proj简直是网络安全反面典范
const groq = new Groq({
    apiKey: '',
    dangerouslyAllowBrowser: true
});
///

interface GroqChatWidgetProps {
    courses: Course[];
    onRecommendation: (recommendedCourseIds: string[]) => void;
}

const GroqChatWidget: React.FC<GroqChatWidgetProps> = ({ courses, onRecommendation }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Array<{role: 'system' | 'user' | 'assistant', content: string}>>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setMessages([
            {
                role: 'system',
                content: '你是一个课程推荐助手。请始终用中文回答所有问题，不许用英文。当用户询问课程推荐时，请根据提供的课程列表给出合适的推荐。你可以推荐一门或多门课程，但必须是课程列表之中的。在回答中，请明确列出你推荐的课程名称，并用【】将每个课程名称括起来，例如【机器学习基础】【深度学习进阶】。请将回答限制在200字以内'
            }
        ]);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user' as const, content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const contextMessage = `以下是可用的课程列表：\n${courses.map(course =>
                `- ${course.title}（类别：${course.category}，描述：${course.description}）`
            ).join('\n')}`;

            const completion = await groq.chat.completions.create({
                messages: [
                    ...messages,
                    { role: 'system', content: contextMessage },
                    userMessage,
                    { role: 'system', content: '请记住，始终用中文回答，并在回答中用【】标记每一个推荐的课程名称。你可以推荐多门课程。' }
                ],
                model: 'mixtral-8x7b-32768',
            });

            const response = completion.choices[0]?.message?.content || '抱歉，我无法生成回答。';
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);

            // 提取推荐的课程
            const recommendedCourses = response.match(/【(.+?)】/g)?.map(course => course.slice(1, -1)) || [];
            const recommendedCourseIds = courses
                .filter(course => recommendedCourses.includes(course.title))
                .map(course => course.id);

            onRecommendation(recommendedCourseIds);

        } catch (error) {
            console.error('调用 Groq API 时出错:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误，请稍后再试。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`groq-chat-widget ${isOpen ? 'open' : ''}`}>
            {!isOpen && (
                <button className="chat-toggle" onClick={() => setIsOpen(true)}>
                    <FontAwesomeIcon icon={faComments} /> 问问AI
                </button>
            )}
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3>AI 助手</h3>
                        <button className="close-button" onClick={() => setIsOpen(false)}>
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.filter(msg => msg.role !== 'system').map((msg, index) => (
                            <div key={index} className={`message ${msg.role}`}>
                                {msg.content}
                            </div>
                        ))}
                        {isLoading && <div className="message assistant">正在思考...</div>}
                    </div>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="输入你的问题..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading}>
                            发送
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default GroqChatWidget;