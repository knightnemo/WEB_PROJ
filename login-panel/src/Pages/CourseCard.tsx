import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { useUser } from './UserContext';
import { UpdateCourseMessage } from 'Plugins/CourseAPI/UpdateCourseMessage';
import axios from 'axios';
import './CourseCard.css';

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;
    interestedUsers?: string;
}

interface CourseCardProps {
    course: Course;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
    console.log('CourseCard initialized with course:', course);
    const history = useHistory();
    const { username } = useUser();
    const defaultImageUrl = "default_course_bg.jpeg";
    const [isFavorite, setIsFavorite] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [interestedUsers, setInterestedUsers] = useState<string[]>([]);

    useEffect(() => {
        console.log('useEffect triggered. Username:', username, 'Course interestedUsers:', course.interestedUsers);
        const users = course.interestedUsers ? course.interestedUsers.split(',').map(u => u.trim()) : [];
        setInterestedUsers(users);
        if (username) {
            setIsFavorite(users.includes(username));
            setHasRated(users.includes(username));
        }
    }, [username, course.interestedUsers]);

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!username) return;

        console.log('toggleFavorite called. Current interestedUsers:', interestedUsers);

        const updatedInterestedUsers = isFavorite
            ? interestedUsers.filter(u => u !== username)
            : [...new Set([...interestedUsers, username])];

        console.log('Updated interestedUsers:', updatedInterestedUsers);

        try {
            const updateCourseMessage = new UpdateCourseMessage(
                course.id,
                course.title,
                course.instructor,
                course.description,
                course.rating,
                course.imageUrl || undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                updatedInterestedUsers
            );

            await axios.post(updateCourseMessage.getURL(), JSON.stringify(updateCourseMessage.toJSON()), {
                headers: { 'Content-Type': 'application/json' },
            });

            setInterestedUsers(updatedInterestedUsers);
            setIsFavorite(!isFavorite);
        } catch (error) {
            console.error('Error updating course favorites:', error);
        }
    };

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
                    {username && (
                        <>
                        <span className="favorite" onClick={toggleFavorite}>
                            <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} />
                        </span>
                            {hasRated && <span className="rated-badge">已评分</span>}
                        </>
                    )}
                </div>
            </div>
        </article>
    );
};