import React, { useState, useEffect, useCallback } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useUser } from './UserContext';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import axios from 'axios';
import './Main.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faStar, faCodeBranch, faSearch, faRobot } from '@fortawesome/free-solid-svg-icons';
import { CourseCard } from './CourseCard';
import GroqChatWidget from './GroqChatWidget';
import NotificationComponent from './NotificationComponent';
import { UserCourseMessage, UserCourseAction } from 'Plugins/CourseAPI/UserCourseMessage';
import { getUserFavoriteCourses, getUserEnrolledCourses } from 'Plugins/CourseAPI/UserCourseInteractions';
import ScrollingNotification from './ScrollingNotification';

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
    interested_users: string[];
}

interface UserInteraction {
    isFavorite: boolean;
    rating: number;
    isEnrolled: boolean;
}

export function Main() {
    const handleGenerateImageClick = () => {
        history.push('/generate-image');
    };

    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isGroqDialogOpen, setIsGroqDialogOpen] = useState(false);
    const [recommendedCourseIds, setRecommendedCourseIds] = useState<string[]>([]);
    const [userInteractions, setUserInteractions] = useState<Record<string, UserInteraction>>({});
    const location = useLocation();
    const [favoriteCourses, setFavoriteCourses] = useState<Course[]>([]);
    const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);

    const handleRecommendation = (recommendedIds: string[]) => {
        setRecommendedCourseIds(recommendedIds);
        setSelectedCategory('recommended');
    };

    const handleGroqButtonClick = () => {
        setIsGroqDialogOpen(true);
    };

    useEffect(() => {
        let isMounted = true;
        fetchCourses(isMounted);
        return () => { isMounted = false };
    }, []);

    const handleAuthAction = (action: 'login' | 'register') => {
        history.push({
            pathname: '/auth',
            state: { action }
        });
    };

    useEffect(() => {
        if (username && courses.length > 0) {
            fetchUserInteractions();
        }
    }, [username, courses, location]); // 添加 location 作为依赖项

    const fetchUserInteractions = async () => {
        if (!username) return;

        const newUserInteractions: Record<string, UserInteraction> = {};

        for (const course of courses) {
            try {
                const userCourseMessage = new UserCourseMessage(username, course.id, UserCourseAction.GetInteraction);
                console.log('username, course_id:', userCourseMessage);
                const response = await axios.post(
                    userCourseMessage.getURL(),
                    userCourseMessage.toJSON(),
                    {
                        headers: { 'Content-Type': 'application/json' }
                    }
                );

                newUserInteractions[course.id] = {
                    isFavorite: response.data.isFavorite,
                    rating: response.data.rating || 0,
                    isEnrolled: response.data.isEnrolled
                };
            } catch (error) {
                console.error(`Error fetching user interaction for course ${course.id}:`, error);
                newUserInteractions[course.id] = {
                    isFavorite: false,
                    rating: 0,
                    isEnrolled: false
                };
            }
        }

        setUserInteractions(newUserInteractions);
    };

    const fetchFavoriteCourses = async () => {
        if (!username) return;
        try {
            const courses = await getUserFavoriteCourses(username);
            setFavoriteCourses(courses);
            setSelectedCategory('favorites');
        } catch (error) {
            console.error('Error fetching favorite courses:', error);
        }
    };

    const fetchEnrolledCourses = async () => {
        if (!username) return;
        try {
            const courses = await getUserEnrolledCourses(username);
            setEnrolledCourses(courses);
            setSelectedCategory('enrolled');
        } catch (error) {
            console.error('Error fetching enrolled courses:', error);
        }
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
                const parsedData = parseScalaList(response.data);
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

    const filteredCourses = courses.filter(course => {
        if (selectedCategory === 'recommended') {
            return recommendedCourseIds.includes(course.id);
        }
        return course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
            (selectedCategory === 'all' || course.category === selectedCategory);
    });

    const categories = ['all', 'recommended', ...new Set(courses.map(course => course.category))];

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
                                                        <h3>{category === 'all' ? '所有类别' : category === 'recommended' ? '推荐课程' : category}</h3>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </li>
                            {username && (
                                <>
                                    <li>
                                        <button onClick={fetchFavoriteCourses}>我的收藏</button>
                                    </li>
                                    <li>
                                        <button onClick={fetchEnrolledCourses}>我正在学</button>
                                    </li>
                                </>
                            )}
                            {isAdmin && (
                                <li><a onClick={() => history.push('/add-course')}>添加课程</a></li>
                            )}
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
                    <NotificationComponent count={3} /> {/* Add this line */}
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
                            <div className="auth-buttons">
                            <button onClick={() => handleAuthAction('login')}>登录</button>
                                <button onClick={() => handleAuthAction('register')}>注册</button>
                            </div>
                        </>
                    )}
                </div>
            </header>
            <ScrollingNotification />
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
                            <CourseCard
                                key={course.id}
                                course={course}
                                userInteraction={userInteractions[course.id]}
                            />
                        ))}
                    </div>
                )}
                {selectedCategory === 'favorites' && (
                    <div className="articles">
                        {favoriteCourses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                userInteraction={userInteractions[course.id]}
                            />
                        ))}
                    </div>
                )}
                {selectedCategory === 'enrolled' && (
                    <div className="articles">
                        {enrolledCourses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                userInteraction={userInteractions[course.id]}
                            />
                        ))}
                    </div>
                )}
            </main>
            <GroqChatWidget courses={courses} onRecommendation={handleRecommendation} />
        </div>
    );
}