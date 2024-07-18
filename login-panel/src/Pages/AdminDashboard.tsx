import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { AllCoursesQueryMessage } from 'Plugins/CourseAPI/AllCoursesQueryMessage';
import {
    Course,
    getCourseEnrolledUsers,
    getCourseRatingUsers,
    getCourseFavoritedUsers,
    calculateAverageRating
} from 'Plugins/CourseAPI/UserCourseInteractions';
import axios from 'axios';
import Modal from 'react-modal';
import './AdminDashboard.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface CourseWithStats extends Course {
    favoriteCount: number;
    enrolledCount: number;
    averageRating: number;
}

const AdminDashboard = () => {
    const history = useHistory();
    const [courses, setCourses] = useState<CourseWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [selectedChart, setSelectedChart] = useState<string | null>(null);

    const handleChangePassword = () => {
        history.push('/change-password');
    };

    const handleSwitchUser = () => {
        history.push('/auth');
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            try {
                const data = await fetchCoursesWithStats();
                if (isMounted) {
                    setCourses(data);
                    setLoading(false);
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Error fetching courses with stats:', error);
                    setLoading(false);
                }
            }
        };
        fetchData();
        return () => {
            isMounted = false;
        };
    }, []);

    const parseScalaList = (input: string): any[] => {
        const content = input.slice(5, -1).trim();
        if (content === '') {
            return [];
        }
        try {
            return JSON.parse(`[${content}]`);
        } catch (error) {
            console.error('Error parsing Scala list:', error);
            return [];
        }
    };

    const fetchCoursesWithStats = async (): Promise<CourseWithStats[]> => {
        try {
            const response = await axios.post(new AllCoursesQueryMessage().getURL(), JSON.stringify(new AllCoursesQueryMessage()), {
                headers: { 'Content-Type': 'application/json' },
            });
            console.log('Raw response:', response.data);
            const parsedData: Course[] = parseScalaList(response.data);
            console.log('Parsed data:', parsedData);

            const coursesWithStats = await Promise.all(parsedData.map(async (course) => {
                try {
                    const [favoritedUsers, enrolledUsers, ratingUsers] = await Promise.all([
                        getCourseFavoritedUsers(course.id),
                        getCourseEnrolledUsers(course.id),
                        getCourseRatingUsers(course.id)
                    ]);
                    console.log(`Course ${course.id} data:`, { favoritedUsers, enrolledUsers, ratingUsers });

                    let ratings: number[] = [];
                    if (Array.isArray(ratingUsers)) {
                        ratings = ratingUsers.map((ratingData: unknown): number => {
                            if (Array.isArray(ratingData) && ratingData.length === 2 && typeof ratingData[1] === 'number') {
                                return ratingData[1];
                            } else if (typeof ratingData === 'object' && ratingData !== null && 'rating' in ratingData && typeof (ratingData as {rating: number}).rating === 'number') {
                                return (ratingData as {rating: number}).rating;
                            }
                            console.warn(`Unexpected rating format for course ${course.id}:`, ratingData);
                            return 0;
                        });
                    } else {
                        console.warn(`Unexpected ratingUsers format for course ${course.id}:`, ratingUsers);
                    }

                    const averageRating = ratings.length > 0 ? parseFloat(calculateAverageRating(ratings)) : 0;

                    return {
                        ...course,
                        favoriteCount: Array.isArray(favoritedUsers) ? favoritedUsers.length : 0,
                        enrolledCount: Array.isArray(enrolledUsers) ? enrolledUsers.length : 0,
                        averageRating
                    };
                } catch (courseError) {
                    console.error(`Error processing course ${course.id}:`, courseError);
                    return {
                        ...course,
                        favoriteCount: 0,
                        enrolledCount: 0,
                        averageRating: 0
                    };
                }
            }));

            console.log('Courses with stats:', coursesWithStats);
            return coursesWithStats;
        } catch (error) {
            console.error('Error fetching courses with stats:', error);
            return [];
        }
    };

    const getMostFavoritedCourses = () => {
        return [...courses].sort((a, b) => b.favoriteCount - a.favoriteCount).slice(0, 5);
    };

    const getMostEnrolledCourses = () => {
        return [...courses].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 5);
    };

    const getHighestRatedCourses = () => {
        return [...courses].sort((a, b) => b.averageRating - a.averageRating).slice(0, 5);
    };

    const getCategoryDistribution = () => {
        const categoryCount = courses.reduce((acc, course) => {
            acc[course.category] = (acc[course.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categoryCount).map(([category, count]) => ({
            category,
            count
        }));
    };

    const handleHome = () => {
        history.push('/');
    };

    const openModal = (chartType: string) => {
        setSelectedChart(chartType);
        setModalIsOpen(true);
    };

    const closeModal = () => {
        setModalIsOpen(false);
        setSelectedChart(null);
    };

    const renderChart = (chartType: string, width: number, height: number) => {
        switch(chartType) {
            case 'favorited':
                return (
                    <BarChart width={width} height={height} data={getMostFavoritedCourses()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="title"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={120}
                            tick={{fontSize: 12}}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="favoriteCount" fill="#8884d8" />
                    </BarChart>
                );
            case 'enrolled':
                return (
                    <BarChart width={width} height={height} data={getMostEnrolledCourses()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="title"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={120}
                            tick={{fontSize: 12}}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="enrolledCount" fill="#82ca9d" />
                    </BarChart>
                );
            case 'rated':
                return (
                    <BarChart width={width} height={height} data={getHighestRatedCourses()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="title"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={120}
                            tick={{fontSize: 12}}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageRating" fill="#ffc658" />
                    </BarChart>
                );
            case 'category':
                return (
                    <PieChart width={width} height={height}>
                        <Pie
                            data={getCategoryDistribution()}
                            dataKey="count"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            outerRadius={Math.min(width, height) / 3}
                            fill="#8884d8"
                            label
                        >
                            {getCategoryDistribution().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );
            default:
                return null;
        }
    };

    if (loading) {
        return <div className="loading">加载中...</div>;
    }

    return (
        <div className="admin-dashboard">
            <header className="admin-header">
                <h1>管理员仪表板</h1>
                <div className="admin-controls">
                    <button onClick={handleChangePassword}>修改密码</button>
                    <button onClick={handleSwitchUser}>切换用户</button>
                    <button onClick={handleHome}>返回主页</button>
                </div>
            </header>

            <div className="chart-grid">
                <div className="chart-container">
                    <h2>最受欢迎的课程（收藏数）</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        {renderChart('favorited', 500, 300)}
                    </ResponsiveContainer>
                    <button onClick={() => openModal('favorited')}>放大</button>
                </div>

                <div className="chart-container">
                    <h2>报名人数最多的课程</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        {renderChart('enrolled', 500, 300)}
                    </ResponsiveContainer>
                    <button onClick={() => openModal('enrolled')}>放大</button>
                </div>

                <div className="chart-container">
                    <h2>评分最高的课程</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        {renderChart('rated', 500, 300)}
                    </ResponsiveContainer>
                    <button onClick={() => openModal('rated')}>放大</button>
                </div>

                <div className="chart-container">
                    <h2>课程类别分布</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        {renderChart('category', 500, 300)}
                    </ResponsiveContainer>
                    <button onClick={() => openModal('category')}>放大</button>
                </div>
            </div>

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Chart Modal"
                style={{
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.75)'
                    },
                    content: {
                        top: '50%',
                        left: '50%',
                        right: 'auto',
                        bottom: 'auto',
                        marginRight: '-50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90%',
                        height: '90%',
                        padding: '20px'
                    }
                }}
            >
                <div className="modal-content">
                    <h2>{selectedChart === 'favorited' ? '最受欢迎的课程' :
                        selectedChart === 'enrolled' ? '报名人数最多的课程' :
                            selectedChart === 'rated' ? '评分最高的课程' :
                                '课程类别分布'}
                    </h2>
                    {selectedChart && renderChart(selectedChart, window.innerWidth * 0.8, window.innerHeight * 0.7)}
                    <button onClick={closeModal}>关闭</button>
                </div>
            </Modal>
        </div>
    );
};

export default AdminDashboard;