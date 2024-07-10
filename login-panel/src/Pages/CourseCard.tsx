import React from 'react';
import { useHistory } from 'react-router-dom';
import './CourseCard.css'

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;
}

interface CourseCardProps {
    course: Course;
}

// 定义一个类型安全的截断函数
const truncateDescription = (description: string, maxLength: number = 20): string => {
    return description.length <= maxLength
        ? description
        : `${description.slice(0, maxLength)}...`;
};

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
    const history = useHistory();
    const defaultImageUrl = "default_course_bg.jpeg";

    const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
        event.currentTarget.src = defaultImageUrl;
    };

    return (
        <article onClick={() => history.push(`/course/${course.id}`)}>
            <figure>
                <img
                    src={course.imageUrl || defaultImageUrl}
                    alt={course.title}
                    onError={handleImageError}
                />
            </figure>
            <div className="article-preview">
                <h2>{course.title}</h2>
                <p className="course-description" title={course.description}>
                    {truncateDescription(course.description)}
                </p>
                <div className="course-info">
                    <span className="instructor">讲师: {course.instructor}</span>
                    <span className="rating">★ {course.rating}</span>
                </div>
            </div>
        </article>
    );
};