import React from 'react';
import { useHistory } from 'react-router-dom';
import './CourseCard.css'

// 确保这个接口与您的 Course 类型一致
interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;  // 注意这里的 '?'，表示 imageUrl 是可选的
}

interface CourseCardProps {
    course: Course;  // 直接使用 Course 类型
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
    const history = useHistory();
    const defaultImageUrl = "https://via.placeholder.com/800x600?text=Course+Image";

    return (
        <article onClick={() => history.push(`/course/${course.id}`)}>
            <figure>
                <img
                    src={course.imageUrl || defaultImageUrl}
                    alt={course.title}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = defaultImageUrl;
                    }}
                />
            </figure>
            <div className="article-preview">
                <h2>{course.title}</h2>
                <p>{course.description}</p>
                <div className="course-info">
                    <span className="instructor">讲师: {course.instructor}</span>
                    <span className="rating">★ {course.rating}</span>
                </div>
            </div>
        </article>
    );
};