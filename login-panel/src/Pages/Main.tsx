import React, { useState, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { useUser } from './UserContext';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import { AddCourseMessage } from 'Plugins/CourseAPI/AddCourseMessage';
import axios from 'axios';
import './Main.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faStar, faCodeBranch } from '@fortawesome/free-solid-svg-icons';

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
    reviews: number;
    imageUrl?: string;
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCourse, setNewCourse] = useState({ title: '', instructor: '', description: '', imageUrl: '' });
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
            const addCourseMessage = new AddCourseMessage(
                newCourse.title,
                newCourse.instructor,
                newCourse.description,
                newCourse.imageUrl || DEFAULT_IMAGE_URL
            );
            await axios.post(addCourseMessage.getURL(), JSON.stringify(addCourseMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            setNewCourse({ title: '', instructor: '', description: '', imageUrl: '' });
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
        if (username) {
            history.push(`/user/${username}`);
        } else {
            history.push('/auth');
        }
    };//knightnemo; 7.7; 这里是加入了一个个人主页界面的跳转

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
                            <button onClick={handleUserClick} className="user-info">
                                <FontAwesomeIcon icon={faUser} className="user-icon" />
                                <span className="user-name">{username}</span>
                                <FontAwesomeIcon icon={faStar} className="icon" />
                                <span className="star-count">52.3k</span>
                                <FontAwesomeIcon icon={faCodeBranch} className="icon" />
                                <span className="fork-count">6.4k</span>
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
                                <ImageUploader onImageUpload={handleImageUpload} />
                                <button type="submit">添加课程</button>
                                <p style={{ color: 'darkgray', fontStyle: 'italic' }}>
                                    如果不上传图片，将使用默认背景图片。
                                </p>
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
                                <img
                                    src={course.imageUrl|| DEFAULT_IMAGE_URL}
                                    alt={course.title}
                                    className="course-image"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src ='https://via.placeholder.com/800x600.png?text=Default+Background+Image'; // 设置一个默认的占位图片
                                    }}
                                />
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