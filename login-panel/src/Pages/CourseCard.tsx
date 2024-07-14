import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { useUser } from './UserContext';
import { UserCourseMessage, UserCourseAction } from 'Plugins/CourseAPI/UserCourseMessage';
import axios from 'axios';
import './CourseCard.css';
import { getCourseRatingUsers, calculateAverageRating } from 'Plugins/CourseAPI/UserCourseInteractions';

interface Course {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    imageUrl?: string;
}

interface UserInteraction {
    isFavorite: boolean;
    rating: number;
    isEnrolled: boolean;
}

interface CourseCardProps {
    course: Course;
    userInteraction?: UserInteraction;
}

const formatDescription = (description: string): string => {
    let formattedDesc1 = description;
    if (description.length <= 70) {
        formattedDesc1 = description.padEnd(70, ' ');
    } else if (description.length > 80) {
        formattedDesc1 = description.slice(0, 77) + '...';
    }
    let formattedDesc2 = '';
    for (let i = 0; i < formattedDesc1.length; i++) {
        if (i > 0 && i % 30 === 0) {
            formattedDesc2 += '\n';
        }
        formattedDesc2 += formattedDesc1[i];
    }
    return formattedDesc2;
};

export const CourseCard: React.FC<CourseCardProps> = ({ course, userInteraction }) => {
    const history = useHistory();
    const { username } = useUser();
    const defaultImageUrl = "default_course_bg.jpeg";
    const [isFavorite, setIsFavorite] = useState(userInteraction?.isFavorite || false);
    const [hasRated, setHasRated] = useState(userInteraction?.rating !== 0);
    const [averageRating, setAverageRating] = useState<string>("0.0");

    useEffect(() => {
        if (userInteraction) {
            setIsFavorite(userInteraction.isFavorite);
            setHasRated(userInteraction.rating !== 0);
        }
        fetchAverageRating();
    }, [userInteraction]);

    const fetchAverageRating = async () => {
        try {
            const ratingUsers = await getCourseRatingUsers(course.id);
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

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!username) return;

        try {
            const favoriteMessage = new UserCourseMessage(username, course.id, UserCourseAction.FavoriteCourse);
            await axios.post(favoriteMessage.getURL(), favoriteMessage.toJSON(), {
                headers: { 'Content-Type': 'application/json' },
            });
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
                <pre>{formatDescription(course.description)}</pre>
                    <div className="course-info">
                        <span className="instructor">讲师: {course.instructor}</span>
                        <span className="rating">★ {averageRating}</span>
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