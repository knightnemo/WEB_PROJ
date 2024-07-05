import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import './Main.css';

interface Course {
    id: number;
    title: string;
    instructor: string;
    rating: number;
    reviews: number;
}

const PlaceholderImage: React.FC<{ text: string }> = ({ text }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="150" // 调整高度以匹配 CSS 中的设置
        viewBox="0 0 200 120"
        style={{ backgroundColor: '#f0f0f0' }}
    >
        <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#333"
            fontSize="14"
        >
            {text}
        </text>
    </svg>
);

export function Main() {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCourses = async () => {
            const mockCourses: Course[] = [
                { id: 1, title: "Web开发入门", instructor: "张三", rating: 4.5, reviews: 120 },
                { id: 2, title: "数据科学与机器学习", instructor: "李四", rating: 4.8, reviews: 200 },
                { id: 3, title: "移动应用开发", instructor: "王五", rating: 4.2, reviews: 80 },
                { id: 4, title: "人工智能基础", instructor: "赵六", rating: 4.6, reviews: 150 },
                { id: 5, title: "网络安全入门", instructor: "钱七", rating: 4.3, reviews: 90 },
                { id: 6, title: "云计算技术", instructor: "孙八", rating: 4.7, reviews: 180 },
            ];
            setCourses(mockCourses);
        };
        fetchCourses();
    }, []);

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUserClick = () => {
        history.push('/auth');
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="header-content">
                    <h1 className="site-title">课程评价网站</h1>
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="搜索课程..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {username ? (
                            <button onClick={handleUserClick} className="user-button">
                                {username}
                            </button>
                        ) : (
                            <button
                                onClick={() => history.push('/auth')}
                                className="auth-button"
                            >
                                注册 / 登录
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="main-content">
                <div className="course-grid">
                    {filteredCourses.map((course) => (
                        <div key={course.id} className="course-card">
                            <PlaceholderImage text={course.title} />
                            <div className="course-details">
                                <h2 className="course-title">{course.title}</h2>
                                <p className="course-instructor">讲师: {course.instructor}</p>
                                <div className="course-rating">
                                    <span className="star">★</span>
                                    <span className="rating-value">{course.rating.toFixed(1)}</span>
                                    <span className="review-count">({course.reviews} 评价)</span>
                                </div>
                                <button
                                    onClick={() => history.push(`/course/${course.id}`)}
                                    className="details-button"
                                >
                                    查看详情
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}