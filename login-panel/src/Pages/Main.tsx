import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import { AddCourseMessage } from 'Plugins/CourseAPI/AddCourseMessage';
import axios from 'axios';
import './Main.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faStar, faCodeBranch } from '@fortawesome/free-solid-svg-icons';
import { CourseCard } from './CourseCard';

interface ImageUploaderProps {
    onImageUpload: (base64Image: string) => void;
}
const DEFAULT_IMAGE_URL = 'https://via.placeholder.com/800x600.png?text=Default+Background+Image';
const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (files: FileList) => {
        const file = files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            onImageUpload(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) handleFiles([blob] as unknown as FileList);
            }
        }
    };

    return (
        <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onPaste={handlePaste}
            className={`image-upload-area ${dragActive ? 'drag-active' : ''}`}
        >
            <input
                type="file"
                id="image-upload"
                onChange={handleChange}
                accept="image/*"
                className="file-input"
            />
            <label htmlFor="image-upload" className="file-label">
                拖放图片到这里，或点击上传
            </label>
        </div>
    );
};

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
/*
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
*/


export function Main() {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCourse, setNewCourse] = useState({
        title: '',
        instructor: '',
        description: '',
        rating: '',
        imageUrl: '',
        resourceUrl: '',
        durationMinutes: 0,
        difficultyLevel: '',
        category: '',
        subcategory: '',
        language: '',
        prerequisites: '',
        learningObjectives: ''
    });
    const [showAddCourseForm, setShowAddCourseForm] = useState(false);

    const handleImageUpload = (base64Image: string) => {
        setNewCourse(prev => ({ ...prev, imageUrl: base64Image }));
    };

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

    const DEFAULT_EMPTY_IMAGE_URL = 'https://via.placeholder.com/300x200?text=No+Image';

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const addCourseMessage = new AddCourseMessage(
                newCourse.title,
                newCourse.instructor,
                newCourse.description,
                newCourse.rating,
                newCourse.imageUrl || DEFAULT_EMPTY_IMAGE_URL,
                newCourse.resourceUrl,
                newCourse.durationMinutes,
                newCourse.difficultyLevel,
                newCourse.category,
                newCourse.subcategory,
                newCourse.language,
                newCourse.prerequisites.split(',').map(item => item.trim()),
                newCourse.learningObjectives.split(',').map(item => item.trim())
            );
            console.log('Sending course data:', JSON.stringify(addCourseMessage.toJSON()));
            const response = await axios.post(addCourseMessage.getURL(), JSON.stringify(addCourseMessage.toJSON()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Server response:', response.data);
            setNewCourse({
                title: '',
                instructor: '',
                description: '',
                rating: '',
                imageUrl: '',
                resourceUrl: '',
                durationMinutes: 0,
                difficultyLevel: '',
                category: '',
                subcategory: '',
                language: '',
                prerequisites: '',
                learningObjectives: ''
            });
            setShowAddCourseForm(false);
            fetchCourses(true);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                console.error('Error adding course:', err.message);
                console.error('Error response:', err.response?.data);
                console.error('Error status:', err.response?.status);
                console.error('Error headers:', err.response?.headers);
            } else {
                console.error('Unexpected error:', err);
            }
            alert('Failed to add course. Please check the console for more details.');
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
                        <svg aria-label="Course Sharing" height="22" role="img" viewBox="0 0 283 64">
                            <path
                                d="M141.68 16.25c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm117.14-14.5c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zm-39.03 3.5c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9v-46h9zM37.59.25l36.95 64H.64l36.95-64zm92.38 5l-27.71 48-27.71-48h10.39l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10v14.8h-9v-34h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"></path>
                        </svg>
                    </a>
                    <nav>
                        <ul className="navigation hide">
                            <li>
                                <button>
                                    Features
                                    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16">
                                        <path
                                            d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path>
                                    </svg>
                                </button>
                                <div className="dropdown__wrapper">
                                    <div className="dropdown">
                                        <ul className="list-items-with-description">
                                            <li>
                                                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"
                                                     stroke-width="2" stroke="currentColor" fill="none"
                                                     stroke-linecap="round"
                                                     stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Previews</h3>
                                                    <p>Zero config, more innovation</p>
                                                </div>
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                     viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                                                     fill="none"
                                                     stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M12 4l-8 4l8 4l8 -4l-8 -4" />
                                                    <path d="M4 12l8 4l8 -4" />
                                                    <path d="M4 16l8 4l8 -4" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Infrastructure</h3>
                                                    <p>Always fast always online</p>
                                                </div>
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg"
                                                     className="icon icon-tabler icon-tabler-brand-nextjs" width="24"
                                                     height="24"
                                                     viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                                                     fill="none"
                                                     stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M9 15v-6l7.745 10.65a9 9 0 1 1 2.255 -1.993" />
                                                    <path d="M15 12v-3" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Next js</h3>
                                                    <p>The native Next.js platform</p>
                                                </div>
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                     viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                                                     fill="none"
                                                     stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                                                    <path d="M3.6 9h16.8" />
                                                    <path d="M3.6 15h16.8" />
                                                    <path d="M11.5 3a17 17 0 0 0 0 18" />
                                                    <path d="M12.5 3a17 17 0 0 1 0 18" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Edge Functions</h3>
                                                    <p>Dynamic pages, static speed</p>
                                                </div>
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                     viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                                                     fill="none"
                                                     stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M3 12h4l3 8l4 -16l3 8h4" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Analytics</h3>
                                                    <p>Real-time insights, peak performance</p>
                                                </div>
                                            </li>
                                            <li>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                     viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
                                                     fill="none"
                                                     stroke-linecap="round" stroke-linejoin="round">
                                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                    <path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0" />
                                                    <path d="M4 6v6a8 3 0 0 0 16 0v-6" />
                                                    <path d="M4 12v6a8 3 0 0 0 16 0v-6" />
                                                </svg>
                                                <div className="item-title">
                                                    <h3>Storage</h3>
                                                    <p>Serverless storage for frontend</p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </li>
                            <li><a href="#docs">Docs</a></li>
                            <li><a href="#templates">Templates</a></li>
                            <li><a href="#customers">Customers</a></li>
                            <li><a href="#enterprise">Enterprise</a></li>
                            <li><a href="#pricing">Pricing</a></li>
                        </ul>
                    </nav>
                </div>
                <div className="action-buttons">
                    {username ? (
                        <button onClick={() => history.push(`/user/${username}`)} className="user-info">
                            <FontAwesomeIcon icon={faUser} className="user-icon" />
                            <span className="user-name">{username}</span>
                            <FontAwesomeIcon icon={faStar} className="icon" />
                            <span className="star-count">52.3k</span>
                            <FontAwesomeIcon icon={faCodeBranch} className="icon" />
                            <span className="fork-count">6.4k</span>
                        </button>
                    ) : (
                        <>
                        <a onClick={() => history.push('/auth?mode=login')} className="secondary">
                                登录
                            </a>
                            <a onClick={() => history.push('/auth?mode=register')} className="primary">
                                注册
                            </a>
                        </>
                    )}
                </div>
            </header>

            <main className="main-content">
                <div className="filter-container">
                    <input
                        type="text"
                        placeholder="搜索课程..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="category-select"
                    >
                        {categories.map(category => (
                            <option key={category} value={category}>
                                {category === 'all' ? '所有类别' : category}
                            </option>
                        ))}
                    </select>
                </div>

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
                                <textarea
                                    placeholder="课程评分"
                                    value={newCourse.rating}
                                    onChange={(e) => setNewCourse({ ...newCourse, rating: e.target.value })}
                                    required
                                ></textarea>
                                <input
                                    type="text"
                                    placeholder="资源链接"
                                    value={newCourse.resourceUrl}
                                    onChange={(e) => setNewCourse({ ...newCourse, resourceUrl: e.target.value })}
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="课程时长（分钟）"
                                    value={newCourse.durationMinutes}
                                    onChange={(e) => setNewCourse({
                                        ...newCourse,
                                        durationMinutes: parseInt(e.target.value),
                                    })}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="难度级别"
                                    value={newCourse.difficultyLevel}
                                    onChange={(e) => setNewCourse({
                                        ...newCourse,
                                        difficultyLevel: e.target.value,
                                    })}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="类别"
                                    value={newCourse.category}
                                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="子类别（可选）"
                                    value={newCourse.subcategory}
                                    onChange={(e) => setNewCourse({ ...newCourse, subcategory: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="语言"
                                    value={newCourse.language}
                                    onChange={(e) => setNewCourse({ ...newCourse, language: e.target.value })}
                                    required
                                />
                                <textarea
                                    placeholder="先决条件（用逗号分隔）"
                                    value={newCourse.prerequisites}
                                    onChange={(e) => setNewCourse({ ...newCourse, prerequisites: e.target.value })}
                                    required
                                ></textarea>
                                <textarea
                                    placeholder="学习目标（用逗号分隔）"
                                    value={newCourse.learningObjectives}
                                    onChange={(e) => setNewCourse({
                                        ...newCourse,
                                        learningObjectives: e.target.value,
                                    })}
                                    required
                                ></textarea>
                                <ImageUploader onImageUpload={handleImageUpload} />
                                <button type="submit">添加课程</button>
                            </form>
                        )}
                    </div>
                )}

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
        </div>
    );
}