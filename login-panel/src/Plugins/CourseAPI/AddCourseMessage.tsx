import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class AddCourseMessage extends CourseMessage {
    title: string;
    instructor: string;
    description: string;
    imageUrl: string;
    resourceUrl: string;
    durationMinutes: number;
    difficultyLevel: string;
    category: string;
    subcategory?: string;
    language: string;
    prerequisites: string[];
    learningObjectives: string[];

    constructor(
        title: string,
        instructor: string,
        description: string,
        imageUrl: string,
        resourceUrl: string,
        durationMinutes: number,
        difficultyLevel: string,
        category: string,
        language: string,
        prerequisites: string[],
        learningObjectives: string[],
        subcategory?: string
    ) {
        super();
        this.title = title;
        this.instructor = instructor;
        this.description = description;
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