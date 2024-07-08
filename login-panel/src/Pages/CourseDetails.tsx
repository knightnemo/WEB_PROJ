import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import { useUser } from './UserContext';
import { CourseQueryMessage } from 'Plugins/CourseAPI/CourseQueryMessage';
import { UpdateCourseMessage } from 'Plugins/CourseAPI/UpdateCourseMessage';
import { DeleteCourseMessage } from 'Plugins/CourseAPI/DeleteCourseMessage';
import axios from 'axios';
import './CourseDetails.css';

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl: string;
    resourceUrl: string;
    durationMinutes: number;
    difficultyLevel: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    learningObjectives: string[];
}

interface Comment {
    id: number;
    user: string;
    content: string;
    likes: number;
    dislikes: number;
}
const DEFAULT_IMAGE_URL = 'https://via.placeholder.com/800x600.png?text=Default+Background+Image';
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

                // 确保 prerequisites 和 learningObjectives 是数组
                const ensureArray = (value: any) => Array.isArray(value) ? value : [];

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

    const handleUpdateCourse = async () => {
        if (!editedCourse) return;
        try {
            const updateCourseMessage = new UpdateCourseMessage(
                editedCourse.id,
                editedCourse.title !== course?.title ? editedCourse.title : undefined,
                editedCourse.instructor !== course?.instructor ? editedCourse.instructor : undefined,
                editedCourse.description !== course?.description ? editedCourse.description : undefined,
                editedCourse.rating !== course?.rating ? editedCourse.rating : undefined,
                editedCourse.imageUrl !== course?.imageUrl ? editedCourse.imageUrl : undefined,
                editedCourse.resourceUrl !== course?.resourceUrl ? editedCourse.resourceUrl : undefined,
                editedCourse.durationMinutes !== course?.durationMinutes ? editedCourse.durationMinutes : undefined,
                editedCourse.difficultyLevel !== course?.difficultyLevel ? editedCourse.difficultyLevel : undefined,
                editedCourse.category !== course?.category ? editedCourse.category : undefined,
                editedCourse.subcategory !== course?.subcategory ? editedCourse.subcategory : undefined,
                editedCourse.language !== course?.language ? editedCourse.language : undefined,
                editedCourse.prerequisites !== course?.prerequisites ? editedCourse.prerequisites : undefined,
                editedCourse.learningObjectives !== course?.learningObjectives ? editedCourse.learningObjectives : undefined
            );
            const response = await axios.post(updateCourseMessage.getURL(), JSON.stringify(updateCourseMessage), {
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.data) {
                setCourse(editedCourse);
                setIsEditing(false);
                alert('课程更新成功');
            } else {
                alert('课程更新失败');
            }
        } catch (err) {
            console.error('Error updating course:', err);
            alert('更新课程时出错');
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
                            {Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0 ? (
                                course.learningObjectives.map((objective, index) => (
                                    <li key={index}>{objective}</li>
                                ))
                            ) : (
                                <li>暂无学习目标</li>
                            )}
                        </ul>
                    </div>
                    <div className="course-prerequisites">
                        <h2>先决条件</h2>
                        <ul>
                            {Array.isArray(course.prerequisites) && course.prerequisites.length > 0 ? (
                                course.prerequisites.map((prerequisite, index) => (
                                    <li key={index}>{prerequisite}</li>
                                ))
                            ) : (
                                <li>无先决条件</li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="course-sidebar">
                    <a href={course.resourceUrl} target="_blank" rel="noopener noreferrer" className="enroll-button">
                        开始学习
                    </a>
                    {isAdmin && (
                        <div className="admin-actions">
                            <button onClick={() => setIsEditing(true)} className="edit-button">编辑课程</button>
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