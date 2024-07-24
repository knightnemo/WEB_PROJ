import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { AddCourseMessage } from 'Plugins/CourseAPI/AddCourseMessage';
import axios from 'axios';
import './AddCourse.css';
import COS from 'cos-js-sdk-v5';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage'
import { useUser } from 'Pages/UserContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { ImageUploader } from './ImageUploader';

const DEFAULT_EMPTY_IMAGE_URL = 'default_course_bg.jpeg';

const cos = new COS({
    SecretId: '',
    SecretKey: '',
});

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

export function AddCourse() {
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCourse, setNewCourse] = useState({
        title: '',
        instructor: '',
        description: '',
        imageFile: null as File | null,
        resourceUrl: '',
        durationMinutes: 0,
        difficultyLevel: '',
        category: '',
        subcategory: '',
        language: '',
        prerequisites: '',
    });

    useEffect(() => {
        if (!isAdmin) {
            history.push('/');
        } else {
            let isMounted = true;
            fetchCourses(isMounted);
            return () => { isMounted = false };
        }
    }, [isAdmin, history]);

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

    const uploadImageToTencentCloud = async (file: File): Promise<string> => {
        const putObjectParams: COS.PutObjectParams = {
            Bucket: 'typesafe-onlinedb-1327835848',
            Region: 'ap-beijing',
            Key: file.name,
            Body: file,
        };

        const result = await cos.putObject(putObjectParams);
        return `https://${putObjectParams.Bucket}.cos.${putObjectParams.Region}.myqcloud.com/${putObjectParams.Key}`;
    };

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let imageUrl = DEFAULT_EMPTY_IMAGE_URL;
            if (newCourse.imageFile) {
                imageUrl = await uploadImageToTencentCloud(newCourse.imageFile);
            }

            const prerequisites = Array.isArray(newCourse.prerequisites)
                ? newCourse.prerequisites
                : newCourse.prerequisites.split(',').map(item => item.trim());

            const addCourseMessage = new AddCourseMessage(
                newCourse.title,
                newCourse.instructor,
                newCourse.description,
                "5",
                imageUrl,
                newCourse.resourceUrl,
                newCourse.durationMinutes,
                newCourse.difficultyLevel,
                newCourse.category,
                newCourse.subcategory,
                newCourse.language,
                prerequisites,
                []
            );
            console.log('Sending course data:', JSON.stringify(addCourseMessage.toJSON()));
            const response = await axios.post(addCourseMessage.getURL(), JSON.stringify(addCourseMessage.toJSON()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Server response:', response.data);
            history.push('/');
        } catch (err) {
            console.error('Error adding course:', err);
            alert('Failed to add course. Please check the console for more details.');
        }
    };

    return (
        <>
            {isAdmin ? (
                <div className="add-course-container">
                    <h1 className="add-course-title">添加新课程</h1>
                    <form onSubmit={handleAddCourse} className="add-course-form">
                <div className="form-group">
                    <label htmlFor="title">课程标题</label>
                    <input
                        id="title"
                        type="text"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="instructor">讲师</label>
                    <input
                        id="instructor"
                        type="text"
                        value={newCourse.instructor}
                        onChange={(e) => setNewCourse({ ...newCourse, instructor: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="description">课程描述</label>
                    <textarea
                        id="description"
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        required
                    ></textarea>
                </div>
                <div className="form-group">
                    <label htmlFor="resourceUrl">资源链接</label>
                    <input
                        id="resourceUrl"
                        type="text"
                        value={newCourse.resourceUrl}
                        onChange={(e) => setNewCourse({ ...newCourse, resourceUrl: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="durationMinutes">课程时长（分钟）</label>
                    <input
                        id="durationMinutes"
                        type="number"
                        value={newCourse.durationMinutes}
                        onChange={(e) => setNewCourse({ ...newCourse, durationMinutes: parseInt(e.target.value) })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="difficultyLevel">难度级别</label>
                    <select
                        id="difficultyLevel"
                        value={newCourse.difficultyLevel}
                        onChange={(e) => setNewCourse({ ...newCourse, difficultyLevel: e.target.value })}
                        required
                    >
                        <option value="">选择难度级别</option>
                        <option value="beginner">初级</option>
                        <option value="intermediate">中级</option>
                        <option value="advanced">高级</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="category">类别</label>
                    <input
                        id="category"
                        type="text"
                        value={newCourse.category}
                        onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="subcategory">子类别（可选）</label>
                    <input
                        id="subcategory"
                        type="text"
                        value={newCourse.subcategory}
                        onChange={(e) => setNewCourse({ ...newCourse, subcategory: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="language">语言</label>
                    <input
                        id="language"
                        type="text"
                        value={newCourse.language}
                        onChange={(e) => setNewCourse({ ...newCourse, language: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="prerequisites">先决条件（用逗号分隔）</label>
                    <textarea
                        id="prerequisites"
                        value={newCourse.prerequisites}
                        onChange={(e) => setNewCourse({ ...newCourse, prerequisites: e.target.value })}
                        required
                    ></textarea>
                </div>
                <div className="form-group">
                    <ImageUploader onImageSelect={(file) => setNewCourse(prev => ({ ...prev, imageFile: file }))} />
                </div>
                <div className="form-actions">
                    <button type="submit" className="submit-btn">添加课程</button>
                    <button type="button" className="cancel-btn" onClick={() => history.push('/')}>
                        <FontAwesomeIcon icon={faTimes} /> 取消
                    </button>
                </div>
                    </form>
                </div>
            ) : (
                <div>You do not have permission to access this page.</div>
            )}
        </>
    );
}