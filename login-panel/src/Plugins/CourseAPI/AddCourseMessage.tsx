import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class AddCourseMessage extends CourseMessage {
    title: string;
    instructor: string;
    description: string;

    constructor(title: string, instructor: string, description: string) {
        super();
        this.title = title;
        this.instructor = instructor;
        this.description = description;
    }
}