import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class UpdateCourseMessage extends CourseMessage {
    id: string;
    title?: string;
    instructor?: string;
    description?: string;
    rating?: number;
    reviews?: number;
    imageUrl?: string;
    resourceUrl?: string;
    durationMinutes?: number;
    difficultyLevel?: string;
    category?: string;
    subcategory?: string;
    language?: string;
    prerequisites?: string[];
    learningObjectives?: string[];

    constructor(
        id: string,
        title?: string,
        instructor?: string,
        description?: string,
        rating?: number,
        reviews?: number,
        imageUrl?: string,
        resourceUrl?: string,
        durationMinutes?: number,
        difficultyLevel?: string,
        category?: string,
        subcategory?: string,
        language?: string,
        prerequisites?: string[],
        learningObjectives?: string[]
    ) {
        super();
        this.id = id;
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.rating = rating;
        this.reviews = reviews;
        this.imageUrl = imageUrl;
        this.resourceUrl = resourceUrl;
        this.durationMinutes = durationMinutes;
        this.difficultyLevel = difficultyLevel;
        this.category = category;
        this.subcategory = subcategory;
        this.language = language;
        this.prerequisites = prerequisites;
        this.learningObjectives = learningObjectives;
    }
}