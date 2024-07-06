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
    rating: number;
    reviews: number;
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
            console.log('Raw course data:', response.data);  // 保留这行日志
            if (response.data) {
                let courseData = response.data;
                // 检查响应是否是字符串，如果是，尝试解析它
                if (typeof courseData === 'string') {
                    try {
                        courseData = JSON.parse(courseData);
                    } catch (error) {
                        console.error('Error parsing course data:', error);
                        throw new Error('Invalid course data format');
                    }
                }
                // 确保所有必要的字段都存在
                courseData = {
                    id: courseData.id || '',
                    title: courseData.title || '无标题',
                    instructor: courseData.instructor || '未知讲师',
                    description: courseData.description || '暂无简介',
                    rating: parseFloat(courseData.rating) || 0,
                    reviews: parseInt(courseData.reviews) || 0
                };
                console.log('Processed course data:', courseData);  // 添加这行来查看处理后的数据
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
                editedCourse.description !== course?.description ? editedCourse.description : undefined
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

    // 在渲染之前确保 rating 是一个数字
    const rating = typeof course.rating === 'string' ? parseFloat(course.rating) : (course.rating || 0);


    return (
        <div className="course-details">
            <div className="container">
                <button onClick={() => history.goBack()} className="back-button">
                    返回上一页
                </button>
                <div className="course-info">
                    {isEditing ? (
                        <div className="edit-course-form">
                            <input
                                type="text"
                                value={editedCourse?.title}
                                onChange={(e) => setEditedCourse(prev => prev ? {...prev, title: e.target.value} : null)}
                            />
                            <input
                                type="text"
                                value={editedCourse?.instructor}
                                onChange={(e) => setEditedCourse(prev => prev ? {...prev, instructor: e.target.value} : null)}
                            />
                            <textarea
                                value={editedCourse?.description}
                                onChange={(e) => setEditedCourse(prev => prev ? {...prev, description: e.target.value} : null)}
                            ></textarea>
                            <button onClick={handleUpdateCourse}>保存更改</button>
                            <button onClick={() => setIsEditing(false)}>取消</button>
                        </div>
                    ) : (
                        <>
                            <h1 className="course-title">{course.title}</h1>
                            <p className="instructor-name">讲师: {course.instructor}</p>
                            <div className="rating">
                                <span className="star">★</span>
                                <span className="rating-value">{course.rating.toFixed(1)}</span>
                                <span className="review-count">({course.reviews} 评价)</span>
                            </div>
                            <p className="description">{course.description}</p>
                            {isAdmin && (
                                <div className="admin-actions">
                                    <button onClick={() => setIsEditing(true)}>编辑课程</button>
                                    <button onClick={handleDeleteCourse}>删除课程</button>
                                </div>
                            )}
                        </>
                    )}
                </div>

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