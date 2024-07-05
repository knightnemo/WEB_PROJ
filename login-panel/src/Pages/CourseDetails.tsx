import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import { useUser } from './UserContext';
import './CourseDetails.css';

interface CourseDetails {
    id: number;
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

const mockCourseDetails: CourseDetails = {
    id: 2,
    title: "数据科学与机器学习",
    instructor: "李四",
    description: "本课程将带你深入了解数据科学和机器学习的核心概念和实践应用。",
    rating: 4.8,
    reviews: 200,
};

const mockComments: Comment[] = [
    { id: 1, user: "张三", content: "非常棒的课程！讲解深入浅出。", likes: 15, dislikes: 2 },
    { id: 2, user: "李明", content: "老师讲得很好，但是作业有点难。", likes: 10, dislikes: 1 },
];

export function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { username } = useUser();
    const [course, setCourse] = useState<CourseDetails | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 模拟API请求延迟
        setTimeout(() => {
            setCourse(mockCourseDetails);
            setComments(mockComments);
            setIsLoading(false);
        }, 1000);
    }, [id]);

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

    if (isLoading) {
        return <div className="loading">加载中...</div>;
    }

    if (!course) {
        return <div className="error">未找到课程信息</div>;
    }

    return (
        <div className="course-details">
            <div className="container">
                <button onClick={() => history.goBack()} className="back-button">
                    返回上一页
                </button>
                <div className="course-info">
                    <h1 className="course-title">{course.title}</h1>
                    <p className="instructor-name">讲师: {course.instructor}</p>
                    <div className="rating">
                        <span className="star">★</span>
                        <span className="rating-value">{course.rating.toFixed(1)}</span>
                        <span className="review-count">({course.reviews} 评价)</span>
                    </div>
                    <p className="description">{course.description}</p>
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