import { CourseMessage } from 'Plugins/CourseAPI/CourseMessage'

export class CourseQueryMessage extends CourseMessage {
    courseId: string;

    constructor(courseId: string) {
        super();
        this.courseId = courseId;
    }
}