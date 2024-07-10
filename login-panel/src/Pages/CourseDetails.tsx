import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import { useUser } from './UserContext';
import { CourseQueryMessage } from 'Plugins/CourseAPI/CourseQueryMessage';
import { UpdateCourseMessage } from 'Plugins/CourseAPI/UpdateCourseMessage';
import { DeleteCourseMessage } from 'Plugins/CourseAPI/DeleteCourseMessage';
import axios from 'axios';
import './CourseDetails.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { ImageUploader } from './ImageUploader';
import COS from 'cos-js-sdk-v5';

const DEFAULT_IMAGE_URL = 'default_course_bg.jpeg';

const cos = new COS({
    SecretId: 'AKIDKQZErVAvmedkp2Kl8UzT6wwNoKoDkO93',
    SecretKey: 'BMdQG9AFWtUbnChCkEo7Ng9gK4tkpvCb',
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
    prerequisites: string[] | string;
    learningObjectives: string[] | string;
}

interface Comment {
    id: number;
    user: string;
    content: string;
    likes: number;
    dislikes: number;
}

const mockComments: Comment[] = [
    { id: 1, user: "张三", content: "非常棒的课程！讲解深入浅出。", likes: 15, dislikes: 2 },
    { id: 2, user: "李明", content: "老师讲得很好，但是作业有点难。", likes: 10, dislikes: 1 },
];

export function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [course, setCourse] = useState<Course | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCourse, setEditedCourse] = useState<Course | null>(null);
    const [newImageFile, setNewImageFile] = useState<File | null>(null);

    useEffect(() => {
        fetchCourse();
    }, [id]);

    const fetchCourse = async () => {
        setIsLoading(true);
        try {
            const courseQueryMessage = new CourseQueryMessage(id);
            const response = await axios.post(courseQueryMessage.getURL(), JSON.stringify(courseQueryMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Raw course data:', response.data);
            if (response.data) {
                let courseData = response.data;
                if (typeof courseData === 'string') {
                    try {
                        courseData = JSON.parse(courseData);
                    } catch (error) {
                        console.error('Error parsing course data:', error);
                        throw new Error('Invalid course data format');
                    }
                }

                const ensureArray = (value: any): string[] =>
                    Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',').map(item => item.trim()) : []);

                courseData = {
                    id: courseData.id || '',
                    title: courseData.title || '无标题',
                    instructor: courseData.instructor || '未知讲师',
                    description: courseData.description || '暂无简介',
                    rating: courseData.rating || '0',
                    imageUrl: courseData.imageUrl || DEFAULT_IMAGE_URL,
                    resourceUrl: courseData.resourceUrl || '',
                    durationMinutes: parseInt(courseData.durationMinutes) || 0,
                    difficultyLevel: courseData.difficultyLevel || '未知',
                    category: courseData.category || '未分类',
                    subcategory: courseData.subcategory,
                    language: courseData.language || '未知',
                    prerequisites: ensureArray(courseData.prerequisites),
                    learningObjectives: ensureArray(courseData.learningObjectives),
                };
                console.log('Processed course data:', courseData);
                setCourse(courseData);
                setEditedCourse(courseData);
                setComments(mockComments);
            } else {
                throw new Error('Course not found');
            }
            setError(null);
        } catch (err) {
            console.error('Error loading course:', err);
            if (axios.isAxiosError(err)) {
                setError(`Failed to load course details. Server responded with: ${err.response?.status} ${err.response?.statusText}`);
            } else {
                setError('Failed to load course details. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username) {
            alert("请先登录后再评论");
            return;
        }
        if (newComment.trim()) {
            const newCommentObj: Comment = {
                id: comments.length + 1,
                user: username,
                content: newComment,
                likes: 0,
                dislikes: 0,
            };
            setComments([...comments, newCommentObj]);
            setNewComment('');
        }
    };

    const handleLike = (commentId: number) => {
        setComments(comments.map(comment =>
            comment.id === commentId ? { ...comment, likes: comment.likes + 1 } : comment
        ));
    };

    const handleDislike = (commentId: number) => {
        setComments(comments.map(comment =>
            comment.id === commentId ? { ...comment, dislikes: comment.dislikes + 1 } : comment
        ));
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

    const handleUpdateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editedCourse) return;
        try {
            let imageUrl = editedCourse.imageUrl || DEFAULT_IMAGE_URL;
            if (newImageFile) {
                imageUrl = await uploadImageToTencentCloud(newImageFile);
            }

            const prerequisites = Array.isArray(editedCourse.prerequisites)
                ? editedCourse.prerequisites
                : editedCourse.prerequisites.split(',').map(item => item.trim());

            const learningObjectives = Array.isArray(editedCourse.learningObjectives)
                ? editedCourse.learningObjectives
                : editedCourse.learningObjectives.split(',').map(item => item.trim());

            const updateCourseMessage = new UpdateCourseMessage(
                editedCourse.id,
                editedCourse.title,
                editedCourse.instructor,
                editedCourse.description,
                editedCourse.rating,
                imageUrl,
                editedCourse.resourceUrl,
                editedCourse.durationMinutes,
                editedCourse.difficultyLevel,
                editedCourse.category,
                editedCourse.subcategory,
                editedCourse.language,
                prerequisites,
                learningObjectives
            );

            console.log('Sending update data:', JSON.stringify(updateCourseMessage.toJSON()));
            const response = await axios.post(updateCourseMessage.getURL(), JSON.stringify(updateCourseMessage.toJSON()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Server response:', response.data);

            if (response.status === 200) {
                setCourse({...editedCourse, imageUrl, prerequisites, learningObjectives});
                setIsEditing(false);
                setNewImageFile(null);
                alert('课程更新成功');
            } else {
                alert(`课程更新失败: ${response.data}`);
            }
        } catch (err) {
            console.error('Error updating course:', err);
            if (axios.isAxiosError(err)) {
                const errorMessage = err.response?.data || err.message;
                alert(`更新课程时出错: ${errorMessage}`);
            } else {
                alert('更新课程时出错，请稍后再试');
            }
        }
    };

    const handleDeleteCourse = async () => {
        if (!course) return;
        if (window.confirm('确定要删除这门课程吗？')) {
            try {
                const deleteCourseMessage = new DeleteCourseMessage(course.id);
                const response = await axios.post(deleteCourseMessage.getURL(), JSON.stringify(deleteCourseMessage), {
                    headers: { 'Content-Type': 'application/json' },
                });
                if (response.data) {
                    alert('课程删除成功');
                    history.push('/');
                } else {
                    alert('课程删除失败');
                }
            } catch (err) {
                console.error('Error deleting course:', err);
                alert('删除课程时出错');
            }
        }
    };

    if (isLoading) {
        return <div className="loading">加载中...</div>;
    }

    if (error || !course) {
        return <div className="error">{error || '未找到课程信息'}</div>;
    }

    return (
        <div className="course-details">
            <div className="course-header">
                <div className="course-header-content">
                    <button onClick={() => history.push('/')} className="back-button">
                        返回主页
                    </button>
                    <h1 className="course-title">{course.title}</h1>
                    <p className="instructor-name">讲师: {course.instructor}</p>
                    <div className="course-meta">
                        <span className="rating">
                            <span className="star">★</span>
                            <span className="rating-value">{course.rating}</span>
                        </span>
                        <span className="duration">{course.durationMinutes} 分钟</span>
                        <span className="difficulty-level">{course.difficultyLevel}</span>
                        <span className="category">{course.category}{course.subcategory ? ` - ${course.subcategory}` : ''}</span>
                        <span className="language">{course.language}</span>
                    </div>
                </div>
            </div>

            <div className="course-content">
                <div className="course-main">
                    {isEditing && editedCourse ? (
                        <form onSubmit={handleUpdateCourse} className="edit-course-form">
                            <div className="form-group">
                                <label htmlFor="title">课程标题</label>
                                <input
                                    id="title"
                                    type="text"
                                    value={editedCourse.title}
                                    onChange={(e) => setEditedCourse({...editedCourse, title: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="instructor">讲师</label>
                                <input
                                    id="instructor"
                                    type="text"
                                    value={editedCourse.instructor}
                                    onChange={(e) => setEditedCourse({...editedCourse, instructor: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">课程描述</label>
                                <textarea
                                    id="description"
                                    value={editedCourse.description}
                                    onChange={(e) => setEditedCourse({...editedCourse, description: e.target.value})}
                                    required
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label htmlFor="rating">课程评分</label>
                                <input
                                    id="rating"
                                    type="text"
                                    value={editedCourse.rating}
                                    onChange={(e) => setEditedCourse({...editedCourse, rating: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="resourceUrl">资源链接</label>
                                <input
                                    id="resourceUrl"
                                    type="text"
                                    value={editedCourse.resourceUrl}
                                    onChange={(e) => setEditedCourse({...editedCourse, resourceUrl: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="durationMinutes">课程时长（分钟）</label>
                                <input
                                    id="durationMinutes"
                                    type="number"
                                    value={editedCourse.durationMinutes}
                                    onChange={(e) => setEditedCourse({...editedCourse, durationMinutes: parseInt(e.target.value)})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="difficultyLevel">难度级别</label>
                                <select
                                    id="difficultyLevel"
                                    value={editedCourse.difficultyLevel}
                                    onChange={(e) => setEditedCourse({...editedCourse, difficultyLevel: e.target.value})}
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
                                    value={editedCourse.category}
                                    onChange={(e) => setEditedCourse({...editedCourse, category: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="subcategory">子类别（可选）</label>
                                <input
                                    id="subcategory"
                                    type="text"
                                    value={editedCourse.subcategory || ''}
                                    onChange={(e) => setEditedCourse({...editedCourse, subcategory: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="language">语言</label>
                                <input
                                    id="language"
                                    type="text"
                                    value={editedCourse.language}
                                    onChange={(e) => setEditedCourse({...editedCourse, language: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="prerequisites">先决条件（用逗号分隔）</label>
                                <textarea
                                    id="prerequisites"
                                    value={Array.isArray(editedCourse.prerequisites) ? editedCourse.prerequisites.join(', ') : editedCourse.prerequisites}
                                    onChange={(e) => setEditedCourse({...editedCourse, prerequisites: e.target.value})}
                                    required
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label htmlFor="learningObjectives">学习目标（用逗号分隔）</label>
                                <textarea
                                    id="learningObjectives"
                                    value={Array.isArray(editedCourse.learningObjectives) ? editedCourse.learningObjectives.join(', ') : editedCourse.learningObjectives}
                                    onChange={(e) => setEditedCourse({...editedCourse, learningObjectives: e.target.value})}
                                    required
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <ImageUploader
                                    onImageSelect={(file) => {
                                        setNewImageFile(file);
                                        if (file) {
                                            setEditedCourse({...editedCourse, imageUrl: URL.createObjectURL(file)});
                                        }
                                    }}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="submit-btn">保存更改</button>
                                <button type="button" className="cancel-btn" onClick={() => {
                                    setIsEditing(false);
                                    setNewImageFile(null);
                                }}>
                                    <FontAwesomeIcon icon={faTimes} /> 取消
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <img
                                src={course.imageUrl || DEFAULT_IMAGE_URL}
                                alt={course.title}
                                className="course-image"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = DEFAULT_IMAGE_URL;
                                }}
                            />
                            <div className="course-description">
                                <h2>课程简介</h2>
                                <p>{course.description}</p>
                            </div>
                            <div className="course-objectives">
                                <h2>学习目标</h2>
                                <ul>
                                    {Array.isArray(course.learningObjectives) ? (
                                        course.learningObjectives.map((objective, index) => (
                                            <li key={index}>{objective}</li>
                                        ))
                                    ) : (
                                        <li>{course.learningObjectives}</li>
                                    )}
                                </ul>
                            </div>
                            <div className="course-prerequisites">
                                <h2>先决条件</h2>
                                <ul>
                                    {Array.isArray(course.prerequisites) ? (
                                        course.prerequisites.map((prerequisite, index) => (
                                            <li key={index}>{prerequisite}</li>
                                        ))
                                    ) : (
                                        <li>{course.prerequisites}</li>
                                    )}
                                </ul>
                            </div>
                        </>
                    )}
                </div>

                <div className="course-sidebar">
                    <a href={course.resourceUrl} target="_blank" rel="noopener noreferrer" className="enroll-button">
                        开始学习
                    </a>
                    {isAdmin && (
                        <div className="admin-actions">
                            <button onClick={() => {
                                setIsEditing(true);
                                setEditedCourse({ ...course });
                            }} className="edit-button">
                                编辑课程
                            </button>
                            <button onClick={handleDeleteCourse} className="delete-button">删除课程</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="comments-section">
                <h2 className="comments-title">评论区</h2>
                <div className="comments-list">
                    {comments.map((comment) => (
                        <div key={comment.id} className="comment">
                            <p className="comment-user">{comment.user}</p>
                            <p className="comment-content">{comment.content}</p>
                            <div className="comment-actions">
                                <button onClick={() => handleLike(comment.id)} className="like-button">
                                    👍 <span>{comment.likes}</span>
                                </button>
                                <button onClick={() => handleDislike(comment.id)} className="dislike-button">
                                    👎 <span>{comment.dislikes}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {username ? (
                    <form onSubmit={handleCommentSubmit} className="comment-form">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="写下你的评论..."
                        ></textarea>
                        <button type="submit" className="submit-button">
                            提交评论
                        </button>
                    </form>
                ) : (
                    <p className="login-prompt">
                        请<Link to="/auth">登录</Link>后评论
                    </p>
                )}
            </div>
        </div>
    );
}