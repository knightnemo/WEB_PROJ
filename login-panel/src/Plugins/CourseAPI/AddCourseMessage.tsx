import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'
import { v4 as uuidv4 } from 'uuid';

export class AddCourseMessage extends CourseMessage {
    id: string;
    title: string;
    instructor: string;
    description: string;
    rating: string;
    image_url: string;
    resource_url: string;
    duration_minutes: number;
    difficulty_level: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    interested_users: string[];

    constructor(
        title: string,
        instructor: string,
        description: string,
        rating: string,
        image_url: string,
        resource_url: string,
        duration_minutes: number,
        difficulty_level: string,
        category: string,
        subcategory: string | undefined,
        language: string,
        prerequisites: string[],
        interested_users: string[]
    ) {
        super();
        this.id = uuidv4();
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.rating = rating;
        this.image_url = image_url;
        this.resource_url = resource_url;
        this.duration_minutes = duration_minutes;
        this.difficulty_level = difficulty_level;
        this.category = category;
        this.subcategory = subcategory;
        this.language = language;
        this.prerequisites = prerequisites;
        this.interested_users = interested_users;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            instructor: this.instructor,
            description: this.description,
            rating: this.rating,
            image_url: this.image_url,
            resource_url: this.resource_url,
            duration_minutes: this.duration_minutes,
            difficulty_level: this.difficulty_level,
            category: this.category,
            subcategory: this.subcategory,
            language: this.language,
            prerequisites: this.prerequisites,
            interested_users: this.interested_users
        };
    }
}