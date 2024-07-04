import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
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

export function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const [course, setCourse] = useState<CourseDetails | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        // 模拟从API获取课程详情
        const fetchCourseDetails = async () => {
            const mockCourse: CourseDetails = {
                id: parseInt(id),
                title: "Web开发入门",
                instructor: "张三",
                description: "这门课程将带你深入了解Web开发的基础知识，包括HTML, CSS和JavaScript。",
                rating: 4.5,
                reviews: 120,
            };
            setCourse(mockCourse);

            const mockComments: Comment[] = [
                { id: 1, user: "用户A", content: "非常棒的课程！", likes: 10, dislikes: 1 },
                { id: 2, user: "用户B", content: "讲解清晰，收获很多。", likes: 8, dislikes: 0 },
            ];
            setComments(mockComments);
        };
        fetchCourseDetails();
    }, [id]);

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newComment.trim()) {
            const newCommentObj: Comment = {
                id: comments.length + 1,
                user: "当前用户",
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

    if (!course) {
        return <div className="loading">加载中...</div>;
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
            </div>
        </div>
    );
}