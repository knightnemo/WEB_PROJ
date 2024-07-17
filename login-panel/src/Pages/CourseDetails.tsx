import React, { useState, useEffect } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import { useUser } from './UserContext';
import { CourseQueryMessage } from 'Plugins/CourseAPI/CourseQueryMessage';
import { UpdateCourseMessage } from 'Plugins/CourseAPI/UpdateCourseMessage';
import { DeleteCourseMessage } from 'Plugins/CourseAPI/DeleteCourseMessage';
import { UserCourseMessage, UserCourseAction } from 'Plugins/CourseAPI/UserCourseMessage';
import { AddCommentMessage } from 'Plugins/CommentAPI/AddCommentMessage';
import { DeleteCommentMessage } from 'Plugins/CommentAPI/DeleteCommentMessage';
import { GetCourseCommentsMessage } from 'Plugins/CommentAPI/GetCourseCommentsMessage';
import { VoteCommentMessage } from 'Plugins/CommentAPI/VoteCommentMessage';
import axios from 'axios';
import './CourseDetails.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faTimes, faStar as faStarSolid, faTrash } from '@fortawesome/free-solid-svg-icons';
import COS from 'cos-js-sdk-v5';
import { ImageUploader } from './ImageUploader';
import { getCourseRatingUsers, calculateAverageRating } from 'Plugins/CourseAPI/UserCourseInteractions';

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
    interested_users: string[] | string;
}

interface Comment {
    id: string;
    userId: string;
    content: string;
    rating: number;
    createdAt: string;
    upvotes: number;
    downvotes: number;
}

export function CourseDetails() {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const { username, isAdmin } = useUser();
    const [course, setCourse] = useState<Course | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [newCommentRating, setNewCommentRating] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedCourse, setEditedCourse] = useState<Course | null>(null);
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [userInteraction, setUserInteraction] = useState<{
        isFavorite: boolean;
        rating: number;
        isEnrolled: boolean;
    }>({ isFavorite: false, rating: 0, isEnrolled: false });
    const [averageRating, setAverageRating] = useState<string>("0.0");

    useEffect(() => {
        fetchCourse();
        if (username) {
            fetchComments();
            fetchUserInteraction();
        }
        fetchAverageRating();
    }, [id, username]);

    const fetchAverageRating = async () => {
        try {
            const ratingUsers = await getCourseRatingUsers(id);
            if (!Array.isArray(ratingUsers)) {
                throw new Error('Unexpected response format');
            }
            const ratings = ratingUsers.map(item => {
                if (typeof item !== 'object' || item === null || !('rating' in item) || typeof item.rating !== 'number') {
                    throw new Error('Invalid rating data');
                }
                return item.rating;
            });
            const avgRating = calculateAverageRating(ratings);
            setAverageRating(avgRating);
        } catch (error) {
            console.error('Error fetching ratings:', error);
            setAverageRating("N/A");
        }
    };

    const fetchUserInteraction = async () => {
        try {
            const userCourseMessage = new UserCourseMessage(username, id, UserCourseAction.GetInteraction);
            console.log('username, course_id:', userCourseMessage);
            const response = await axios.post(
                userCourseMessage.getURL(),
                userCourseMessage.toJSON(),
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            setUserInteraction({
                isFavorite: response.data.isFavorite,
                rating: response.data.rating || 0,
                isEnrolled: response.data.isEnrolled
            });
            console.log('User interaction:', response.data);
        } catch (error) {
            console.error('Error fetching user interaction:', error);
        }
    };

    const handleRating = async (rating: number) => {
        if (!course || !username) return;

        try {
            let newRating = rating;
            if (userInteraction.rating === rating) {
                newRating = 0;
            }

            const rateMessage = new UserCourseMessage(username, course.id, UserCourseAction.RateCourse, newRating);
            await axios.post(rateMessage.getURL(), rateMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });

            setUserInteraction(prev => ({ ...prev, rating: newRating }));
            fetchAverageRating();
        } catch (error) {
            console.error('Error updating course rating:', error);
        }
    };

    const renderRatingStars = () => {
        return [1, 2, 3, 4, 5].map((star) => (
            <FontAwesomeIcon
                key={star}
                icon={star <= (userInteraction.rating || 0) ? faStarSolid : faStarRegular}
                onClick={() => handleRating(star)}
                className={`rating-star ${userInteraction.rating ? '' : 'clickable'}`}
            />
        ));
    };

    const toggleFavorite = async () => {
        if (!course || !username) return;

        try {
            const favoriteMessage = new UserCourseMessage(username, course.id, UserCourseAction.FavoriteCourse);
            await axios.post(favoriteMessage.getURL(), favoriteMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });

            setUserInteraction(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
        } catch (error) {
            console.error('Error updating course favorites:', error);
        }
    };

    const enrollCourse = async () => {
        if (!course || !username) return;

        try {
            const enrollMessage = new UserCourseMessage(username, course.id, UserCourseAction.EnrollCourse);
            await axios.post(enrollMessage.getURL(), enrollMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });

            setUserInteraction(prev => ({ ...prev, isEnrolled: true }));
        } catch (error) {
            console.error('Error enrolling in course:', error);
        }
    };

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
                    ...courseData,
                    prerequisites: ensureArray(courseData.prerequisites),
                    interested_users: ensureArray(courseData.interestedUsers),
                };
                console.log('Processed course data:', courseData);
                setCourse(courseData);
                setEditedCourse(courseData);
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

    const fetchComments = async () => {
        try {
            const getCommentsMessage = new GetCourseCommentsMessage(id, 1, 100); // 假设每页100条评论
            const response = await axios.post(getCommentsMessage.getURL(), getCommentsMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });
            setComments(response.data);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username) {
            alert("请先登录后再评论");
            return;
        }
        if (newComment.trim() && newCommentRating > 0) {
            try {
                const addCommentMessage = new AddCommentMessage(id, username, newComment, newCommentRating);
                const response = await axios.post(addCommentMessage.getURL(), JSON.stringify(addCommentMessage), {
                    headers: { 'Content-Type': 'application/json' },
                });
                if (response.data) {
                    fetchComments(); // 重新获取评论列表
                    setNewComment('');
                    setNewCommentRating(0);
                }
            } catch (error) {
                console.error('Error adding comment:', error);
                alert('添加评论失败，请稍后再试');
            }
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (window.confirm('确定要删除这条评论吗？')) {
            try {
                const deleteCommentMessage = new DeleteCommentMessage(commentId);
                const response = await axios.post(deleteCommentMessage.getURL(), JSON.stringify(deleteCommentMessage), {
                    headers: { 'Content-Type': 'application/json' },
                });
                if (response.data) {
                    fetchComments(); // 重新获取评论列表
                }
            } catch (error) {
                console.error('Error deleting comment:', error);
                alert('删除评论失败，请稍后再试');
            }
        }
    };
    //const [comments, setComments] = useState<Comment[]>([]);
    const [isVoting, setIsVoting] = useState(false);

    const handleVote = async (commentId: string, voteType: 'upvote' | 'downvote') => {
        if (!username) {
            alert("请先登录后再投票");
            return;
        }

        if (isVoting) {
            return; // 防止重复点击
        }

        setIsVoting(true);

        try {
            const voteMessage = new VoteCommentMessage(commentId, username, voteType);
            const response = await axios.post(voteMessage.getURL(), voteMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });

            if (response.data) {
                // 投票成功后重新获取评论
                await fetchComments();
            }
        } catch (error) {
            console.error('Error voting on comment:', error);
            alert('投票失败，请稍后再试');
        } finally {
            setIsVoting(false);
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

    const handleUpdateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editedCourse || !course) return;
        try {
            let imageUrl = editedCourse.imageUrl || DEFAULT_IMAGE_URL;
            if (newImageFile) {
                imageUrl = await uploadImageToTencentCloud(newImageFile);
            }
            const updatedInterestedUsers = [username];

            const prerequisites = Array.isArray(editedCourse.prerequisites)
                ? editedCourse.prerequisites
                : editedCourse.prerequisites.split(',').map(item => item.trim());

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
                updatedInterestedUsers
            );

            console.log('Sending update data:', JSON.stringify(updateCourseMessage.toJSON()));
            const response = await axios.post(updateCourseMessage.getURL(), JSON.stringify(updateCourseMessage.toJSON()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Server response:', response.data);

            if (response.status === 200) {
                setCourse({
                    ...editedCourse,
                    imageUrl,
                    prerequisites,
                    interested_users: course.interested_users
                });
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
                            <span className="rating-value">{averageRating}</span>
                        </span>
                        <span className="duration">{course.durationMinutes} 分钟</span>
                        <span className="difficulty-level">{course.difficultyLevel}</span>
                        <span className="category">{course.category}{course.subcategory ? ` - ${course.subcategory}` : ''}</span>
                        <span className="language">{course.language}</span>
                        {username && (
                            <span className="favorite" onClick={toggleFavorite}>
                                <FontAwesomeIcon icon={userInteraction.isFavorite ? faStarSolid : faStarRegular} />
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="course-content">
                <div className="course-main">
                    {isEditing && editedCourse ? (
                        <form onSubmit={handleUpdateCourse} className="edit-course-form">
                            {/* 编辑表单内容 */}
                            {/* ... */}
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
                    {userInteraction.isEnrolled ? (
                        <a href={course.resourceUrl} target="_blank" rel="noopener noreferrer" className="enroll-button">
                            继续学习
                        </a>
                    ) : (
                        <button onClick={enrollCourse} className="enroll-button">
                            开始学习
                        </button>
                    )}
                    {username && (
                        <>
                            <div className="rating-section">
                                <h3>{userInteraction.rating ? '您的评分' : '为课程打分'}</h3>
                                {renderRatingStars()}
                                {userInteraction.rating && (
                                    <button onClick={() => handleRating(userInteraction.rating || 0)}
                                            className="cancel-rating">
                                        取消评分
                                    </button>
                                )}
                            </div>
                            <button onClick={toggleFavorite} className="favorite-button">
                                {userInteraction.isFavorite ? '取消收藏' : '收藏课程'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="comments-section">
                <h2 className="comments-title">评论区</h2>
                {username ? (
                    <>
                        <div className="comments-list">
                            {comments.length > 0 ? (
                                comments.map((comment) => (
                                    <div key={comment.id} className="comment">
                                        <p className="comment-user">{comment.userId}</p>
                                        <p className="comment-content">{comment.content}</p>
                                        <div className="comment-meta">
                                            <span className="comment-rating">评分: {comment.rating}</span>
                                            <span className="comment-date">{new Date(comment.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="comment-actions">
                                            <button
                                                className="like-button"
                                                onClick={() => handleVote(comment.id, 'upvote')}
                                                disabled={isVoting}
                                            >
                                                👍 <span>{comment.upvotes}</span>
                                            </button>
                                            <button
                                                className="dislike-button"
                                                onClick={() => handleVote(comment.id, 'downvote'
                                                )}
                                                disabled={isVoting}
                                            >
                                                👎 <span>{comment.downvotes}</span>
                                            </button>
                                            {username === comment.userId && (
                                                <button onClick={() => handleDeleteComment(comment.id)}
                                                        className="delete-button">
                                                    <FontAwesomeIcon icon={faTrash}/> 删除
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-comments">还没有评论，成为第一个评论的人吧！</p>
                            )}
                        </div>

                        <form onSubmit={handleCommentSubmit} className="comment-form">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="写下你的评论..."
                            ></textarea>
                            <div className="comment-rating-input">
                                <label>评分：</label>
                                <select
                                    value={newCommentRating}
                                    onChange={(e) => setNewCommentRating(Number(e.target.value))}
                                >
                                    <option value="0">选择评分</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                </select>
                            </div>
                            <button type="submit" className="submit-button">
                                提交评论
                            </button>
                        </form>
                    </>
                ) : (
                    <p className="login-prompt">
                        请<Link to="/auth">登录</Link>后查看和发布评论
                    </p>
                )}
            </div>
        </div>
    );
}