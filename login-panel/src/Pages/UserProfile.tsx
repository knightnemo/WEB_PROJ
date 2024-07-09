import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import axios from 'axios';
import './UserProfile.css';
import { AllUsersQueryMessage } from 'Plugins/PatientAPI/AllUsersQueryMessage';
import { DoctorQueryMessage } from 'Plugins/DoctorAPI/DoctorQueryMessage';
import { useUser } from './UserContext';
type UserData = string | { username: string, [key: string]: any };
interface UserInfo {
    username: string;
    bio: string;
    followers: number;
    following: number;
    reviewCount: number;
}

interface Review {
    id: string;
    courseTitle: string;
    rating: number;
    content: string;
    date: string;
}

export function UserProfile() {
    const { username } = useParams<{ username: string }>();
    const history = useHistory();
    const { isAdmin } = useUser();
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUserInfo();
        fetchUserReviews();
    }, [username]);

    const fetchUserInfo = async () => {
        setIsLoading(true);
        try {
            let response;
            if (isAdmin) {
                const doctorQueryMessage = new DoctorQueryMessage(username);
                response = await axios.post(doctorQueryMessage.getURL(), JSON.stringify(doctorQueryMessage), {
                    headers: { 'Content-Type': 'application/json' },
                });
            } else {
                const allUsersQueryMessage = new AllUsersQueryMessage();
                response = await axios.post(allUsersQueryMessage.getURL(), JSON.stringify(allUsersQueryMessage), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (response.data) {
                let userData: UserData;
                if (isAdmin) {
                    userData = response.data as UserData;
                } else {
                    const allUsers: UserData[] = response.data;
                    userData = allUsers.find(user =>
                        typeof user === 'string' ? user === username : user.username === username
                    );
                }

                if (userData) {
                    setUserInfo({
                        username: typeof userData === 'string' ? userData : username,
                        bio: typeof userData === 'string' ? generateRandomBio() : (userData.bio || generateRandomBio()),
                        followers: typeof userData === 'string' ? Math.floor(Math.random() * 1000) : (userData.followers || Math.floor(Math.random() * 1000)),
                        following: typeof userData === 'string' ? Math.floor(Math.random() * 500) : (userData.following || Math.floor(Math.random() * 500)),
                        reviewCount: typeof userData === 'string' ? Math.floor(Math.random() * 50) : (userData.reviewCount || Math.floor(Math.random() * 50))
                    });
                } else {
                    throw new Error('User not found');
                }
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Error fetching user info:', err);
            setError('Failed to load user information');
            // 使用随机生成的数据作为后备
            setUserInfo({
                username: username,
                bio: generateRandomBio(),
                followers: Math.floor(Math.random() * 1000),
                following: Math.floor(Math.random() * 500),
                reviewCount: Math.floor(Math.random() * 50)
            });
        } finally {
            setIsLoading(false);
        }
    };


    const fetchUserReviews = async () => {
        try {
            // 生成随机评价
            const randomReviews = Array(5).fill(null).map(() => ({
                id: Math.random().toString(36).substr(2, 9),
                courseTitle: generateRandomCourseTitle(),
                rating: Math.floor(Math.random() * 5) + 1,
                content: generateRandomReviewContent(),
                date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0]
            }));
            setReviews(randomReviews);
        } catch (err) {
            console.error('Error fetching user reviews:', err);
            setError('Failed to load user reviews');
        } finally {
            setIsLoading(false);
        }
    };

    const generateRandomBio = () => {
        const bios = [
            "热爱学习，追求知识",
            "终身学习者，热衷于分享知识",
            "对教育充满热情的学生",
            "喜欢探索新课程的好奇心学习者"
        ];
        return bios[Math.floor(Math.random() * bios.length)];
    };

    const generateRandomCourseTitle = () => {
        const titles = [
            "Web开发基础",
            "数据结构与算法",
            "人工智能导论",
            "移动应用开发",
            "云计算技术"
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    };

    const generateRandomReviewContent = () => {
        const contents = [
            "这门课程内容丰富，讲解清晰，非常推荐！",
            "老师讲解得很细致，但作业有点难度。",
            "课程设计很合理，学到了很多实用知识。",
            "整体不错，但希望能有更多的实践机会。",
            "超出预期的好课程，学习体验很棒！"
        ];
        return contents[Math.floor(Math.random() * contents.length)];
    };

    const handleAuthClick = () => {
        history.push('/auth');
    };

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>{error}</div>;
    if (!userInfo) return <div>User not found</div>;

    return (
        <div className="user-profile-container">
            <header className="profile-header">
                <h1 className="site-title">课程评价网站</h1>
                <nav className="profile-nav">
                    <button onClick={() => history.push('/')} className="nav-button">
                        返回主页
                    </button>
                    <button onClick={handleAuthClick} className="nav-button">
                        切换用户
                    </button>
                </nav>
            </header>

            <main className="profile-content">
                <section className="user-info-section">
                    <div className="user-header">
                        <h2>{userInfo.username}</h2>
                        <button onClick={() => history.push('/change-password')} className="change-password-button">
                            修改密码
                        </button>
                    </div>
                    <p className="user-bio">{userInfo.bio}</p>
                    <div className="user-stats">
                        <div className="stat-item">
                            <span className="stat-value">{userInfo.followers}</span>
                            <span className="stat-label">关注者</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{userInfo.following}</span>
                            <span className="stat-label">关注</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{userInfo.reviewCount}</span>
                            <span className="stat-label">评价数</span>
                        </div>
                    </div>
                </section>

                <section className="user-reviews-section">
                    <h3>用户评价</h3>
                    <div className="reviews-list">
                        {reviews.map((review) => (
                            <div key={review.id} className="review-card">
                                <h4>{review.courseTitle}</h4>
                                <div className="review-rating">
                                    <span className="star">★</span>
                                    <span>{review.rating.toFixed(1)}</span>
                                </div>
                                <p className="review-content">{review.content}</p>
                                <span className="review-date">{review.date}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}