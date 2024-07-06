import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class UpdateCourseMessage extends CourseMessage {
    id: string;
    title?: string;
    instructor?: string;
    description?: string;
    rating?: number;
    reviews?: number;

    constructor(id: string, title?: string, instructor?: string, description?: string, rating?: number, reviews?: number) {
        super();
        this.id = id;
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.rating = rating;
        this.reviews = reviews;
    }
}