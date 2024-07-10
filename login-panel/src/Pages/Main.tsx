import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import axios from 'axios';
import './Main.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faStar, faCodeBranch, faSearch, faRobot } from '@fortawesome/free-solid-svg-icons';
import { CourseCard } from './CourseCard';

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;
    resourceUrl: string;
    durationMinutes: number;
    difficultyLevel: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    learningObjectives: string[];
}

export function Main() {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        fetchCourses(isMounted);
        return () => { isMounted = false };
    }, []);

    const handleGroqButtonClick = () => {
        history.push('/groq-chat');
    };
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
                    parsedData = [];
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

    const filteredCourses = courses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (selectedCategory === 'all' || course.category === selectedCategory)
    );

    const categories = ['all', ...new Set(courses.map(course => course.category))];

    const handleUserClick = () => {
        if (username) {
            history.push(`/user/${username}`);
        } else {
            history.push('/auth');
        }
    };//knightnemo; 7.7; 这里是加入了一个个人主页界面的跳转

    return (
        <div className="app-container">
            <header className="menu__wrapper">
                <div className="menu__bar">
                    <a href="#" title="Home" aria-label="home" className="logo">
                        <h1 className="logo-text">Course Sharing</h1>
                    </a>
                    <nav>
                        <ul className="navigation">
                            <li>
                                <button onClick={() => setSelectedCategory('all')}>
                                    课程分类
                                    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
                                        <path
                                            d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path>
                                    </svg>
                                </button>
                                <div className="dropdown__wrapper">
                                    <div className="dropdown">
                                        <ul className="list-items-with-description">
                                            {categories.map(category => (
                                                <li key={category} onClick={() => setSelectedCategory(category)}>
                                                    <div className="item-title">
                                                        <h3>{category === 'all' ? '所有类别' : category}</h3>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </li>
                            <li><a onClick={() => history.push('/add-course')}>添加课程</a></li>
                        </ul>
                    </nav>
                </div>
                <div className="action-buttons">
                    <div className="search-container">
                        <FontAwesomeIcon icon={faSearch} className="search-icon" />
                        <input
                            type="text"
                            placeholder="搜索课程..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    {username ? (
                        <button onClick={() => history.push(`/user/${username}`)} className="user-info-button">
                            <FontAwesomeIcon icon={faUser} className="user-icon" />
                            <span className="user-name">{username}</span>
                            <div className="user-stats">
                                <FontAwesomeIcon icon={faStar} className="icon" />
                                <span className="stat-count">52.3k</span>
                                <FontAwesomeIcon icon={faCodeBranch} className="icon" />
                                <span className="stat-count">6.4k</span>
                            </div>
                        </button>
                    ) : (
                        <>
                            <a onClick={() => history.push('/auth?mode=login')} className="auth-button secondary">
                                登录
                            </a>
                            <a onClick={() => history.push('/auth?mode=register')} className="auth-button primary">
                                注册
                            </a>
                        </>
                    )}
                </div>
            </header>
            <main className="main-content">
                {isLoading ? (
                    <p>Loading courses...</p>
                ) : error ? (
                    <p className="error-message">{error}</p>
                ) : filteredCourses.length === 0 ? (
                    <p>No courses available. {isAdmin ? 'Try adding a new course!' : ''}</p>
                ) : (
                    <div className="articles">
                        {filteredCourses.map((course) => (
                            <CourseCard key={course.id} course={course} />
                        ))}
                    </div>
                )}
            </main>
            <button
                className="floating-button"
                onClick={handleGroqButtonClick}
            >
                <FontAwesomeIcon icon={faRobot} />
                问问Groq
            </button>
        </div>
    );
}