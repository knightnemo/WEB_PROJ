import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class UpdateCourseMessage extends CourseMessage {
    id: string;
    title?: string;
    instructor?: string;
    description?: string;
    rating?: string;
    imageUrl?: string;
    resourceUrl?: string;
    durationMinutes?: number;
    difficultyLevel?: string;
    category?: string;
    subcategory?: string;
    language?: string;
    prerequisites?: string[];
    interested_users?: string[];

    constructor(
        id: string,
        title?: string,
        instructor?: string,
        description?: string,
        rating?: string,
        imageUrl?: string,
        resourceUrl?: string,
        durationMinutes?: number,
        difficultyLevel?: string,
        category?: string,
        subcategory?: string,
        language?: string,
        prerequisites?: string[],
        interested_users?: string[]
    ) {
        super();
        this.id = id;
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.rating = rating;
        this.imageUrl = imageUrl;
        this.resourceUrl = resourceUrl;
        this.durationMinutes = durationMinutes;
        this.difficultyLevel = difficultyLevel;
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
            image_url: this.imageUrl,
            resource_url: this.resourceUrl,
            duration_minutes: this.durationMinutes,
            difficulty_level: this.difficultyLevel,
            category: this.category,
            subcategory: this.subcategory,
            language: this.language,
            prerequisites: this.prerequisites,
            interested_users: this.interested_users
        };
    }
}