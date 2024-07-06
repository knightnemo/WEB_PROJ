import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import { AddCourseMessage } from 'Plugins/CourseAPI/AddCourseMessage';
import axios from 'axios';
import './Main.css';

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    reviews: number;
}

const PlaceholderImage: React.FC<{ text: string }> = ({ text }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="150"
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCourse, setNewCourse] = useState({ title: '', instructor: '', description: '' });
    const [showAddCourseForm, setShowAddCourseForm] = useState(false);

    useEffect(() => {
        let isMounted = true;
        fetchCourses(isMounted);
        return () => { isMounted = false };
    }, []);

    const parseScalaList = (input: string): any[] => {
        // 移除 "List(" 前缀和结尾的 ")"
        const content = input.slice(5, -1).trim();

        // 如果内容为空，返回空数组
        if (content === '') {
            return [];
        }

        // 使用正则表达式匹配每个 JSON 对象
        const jsonObjects = content.match(/\{[^{}]*\}/g);

        if (!jsonObjects) {
            throw new Error('No valid JSON objects found in the input string');
        }

        // 解析每个 JSON 对象
        return jsonObjects.map(jsonStr => JSON.parse(jsonStr));
    };

    const fetchCourses = async (isMounted: boolean) => {
        setIsLoading(true);
        try {
            const response = await axios.post(new AllCoursesQueryMessage().getURL(), JSON.stringify(new AllCoursesQueryMessage()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Raw response:', response.data);
            if (isMounted) {
                let parsedData: Course[];
                if (typeof response.data === 'string' && response.data.startsWith('List(')) {
                    parsedData = parseScalaList(response.data);
                } else if (Array.isArray(response.data)) {
                    parsedData = response.data;
                } else {
                    console.error('Unexpected response format:', response.data);
                    parsedData = []; // Set to empty array instead of throwing an error
                }
                console.log('Parsed data:', parsedData);
                setCourses(parsedData);
                setError(null);
            }
        } catch (err) {
            console.error('Error loading courses:', err);
            if (isMounted) {
                setError('Failed to load courses. Please try again later.');
            }
        } finally {
            if (isMounted) {
                setIsLoading(false);
            }
        }
    };

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const addCourseMessage = new AddCourseMessage(newCourse.title, newCourse.instructor, newCourse.description);
            await axios.post(addCourseMessage.getURL(), JSON.stringify(addCourseMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            setNewCourse({ title: '', instructor: '', description: '' });
            setShowAddCourseForm(false);
            fetchCourses(true);
        } catch (err) {
            console.error('Error adding course:', err);
            alert('Failed to add course. Please try again.');
        }
    };

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
                {isAdmin && (
                    <div className="add-course-section">
                        <button onClick={() => setShowAddCourseForm(!showAddCourseForm)}>
                            {showAddCourseForm ? '取消' : '添加课程'}
                        </button>
                        {showAddCourseForm && (
                            <form onSubmit={handleAddCourse} className="add-course-form">
                                <input
                                    type="text"
                                    placeholder="课程标题"
                                    value={newCourse.title}
                                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="讲师"
                                    value={newCourse.instructor}
                                    onChange={(e) => setNewCourse({ ...newCourse, instructor: e.target.value })}
                                    required
                                />
                                <textarea
                                    placeholder="课程描述"
                                    value={newCourse.description}
                                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                                    required
                                ></textarea>
                                <button type="submit">添加课程</button>
                            </form>
                        )}
                    </div>
                )}
                {isLoading ? (
                    <p>Loading courses...</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : courses.length === 0 ? (
                    <p>No courses available. {isAdmin ? 'Try adding a new course!' : ''}</p>
                ) : (
                    <div className="course-grid">
                        {filteredCourses.map((course) => (
                            <div key={course.id} className="course-card">
                                <PlaceholderImage text={course.title} />
                                <div className="course-details">
                                    <h2 className="course-title">{course.title}</h2>
                                    <p className="course-instructor">讲师: {course.instructor}</p>
                                    <div className="course-rating">
                                        <span className="star">★</span>
                                        <span className="rating-value">{parseFloat(course.rating).toFixed(1)}</span>
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
                )}
            </main>
        </div>
    );
}