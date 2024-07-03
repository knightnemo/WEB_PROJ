import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './CourseDetails.css'; // 确保创建这个文件来包含自定义CSS

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
        return <div className="text-center mt-8">加载中...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100 py-8">
            <div className="container mx-auto px-4">
                <div className="bg-white rounded-lg shadow-lg p-8 animate-fade-in-up">
                    <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
                    <p className="text-xl text-gray-600 mb-4">讲师: {course.instructor}</p>
                    <div className="flex items-center mb-6">
                        <span className="text-yellow-500 mr-2">★</span>
                        <span className="text-2xl font-bold">{course.rating.toFixed(1)}</span>
                        <span className="text-gray-500 ml-2">({course.reviews} 评价)</span>
                    </div>
                    <p className="text-gray-700 mb-8">{course.description}</p>

                    <h2 className="text-2xl font-bold mb-4">评论区</h2>
                    <div className="space-y-4 mb-8">
                        {comments.map((comment) => (
                            <div key={comment.id} className="bg-gray-100 rounded-lg p-4">
                                <p className="font-bold mb-2">{comment.user}</p>
                                <p className="mb-2">{comment.content}</p>
                                <div className="flex items-center space-x-4">
                                    <button onClick={() => handleLike(comment.id)} className="flex items-center space-x-1 text-green-500 hover:text-green-600 transition duration-300">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                                        </svg>
                                        <span>{comment.likes}</span>
                                    </button>
                                    <button onClick={() => handleDislike(comment.id)} className="flex items-center space-x-1 text-red-500 hover:text-red-600 transition duration-300">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v5.43a2 2 0 01-1.106 1.79l-.05.025A4 4 0 0011.943 18H6.527a2 2 0 01-1.962-1.608l-1.2-6A2 2 0 014.44 8H8V4a2 2 0 012-2 1 1 0 011 1v.667a4 4 0 00.8 2.4l1.4 1.866a4 4 0 00.8 2.4z" />
                                        </svg>
                                        <span>{comment.dislikes}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleCommentSubmit} className="mt-8">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-300"
                            rows={4}
                            placeholder="写下你的评论..."
                        ></textarea>
                        <button
                            type="submit"
                            className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition duration-300 transform hover:scale-105"
                        >
                            提交评论
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}