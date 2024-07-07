import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class AddCourseMessage extends CourseMessage {
    title: string;
    instructor: string;
    description: string;
    imageUrl?: string;

    constructor(title: string, instructor: string, description: string, imageUrl: string) {
        super();
        this.title = title;
        this.instructor = instructor;
        this.description = description;
        this.imageUrl = imageUrl;
    }
}